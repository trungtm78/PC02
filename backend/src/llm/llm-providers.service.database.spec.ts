import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { LlmKeyService } from './llm-key.service';
import { LlmProvidersService } from './llm-providers.service';
import type { LlmProviderFactory, ProviderSettings } from './provider-factory';
import type { LlmProvider, LlmRequest, LlmResult } from './llm.types';
import { LlmError } from './llm.types';

/**
 * LlmProvidersService on REAL PostgreSQL: the rules that decide whether a provider may be used.
 * Runs only with `PETITION_SUGGEST_DATABASE_URL` (127.0.0.1/pc02_goiy_scope_test); CI makes a missing database a failure.
 */
const url = process.env.PETITION_SUGGEST_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.PETITION_SUGGEST_DATABASE_REQUIRED === '1') {
  it('the scratch database is mandatory (PETITION_SUGGEST_DATABASE_URL)', () => {
    expect(url).toBeTruthy();
  });
}

const ACTOR = { id: 'actor-1' };
const PLAIN_KEY = 'sk-ant-PLAINTEXT-0123456789';

/** A provider that passes the five-step key test, or fails it with the given code. */
function scriptedProvider(
  settings: ProviderSettings,
  failure: LlmError | null,
): LlmProvider {
  const result = (json: unknown): LlmResult => ({
    json,
    usage: { inputTokens: 3, outputTokens: 2 },
    latencyMs: 10,
    model: settings.model,
    providerKind: settings.kind,
  });
  return {
    kind: settings.kind,
    model: settings.model,
    listModels: () =>
      failure
        ? Promise.reject(failure)
        : Promise.resolve([{ id: settings.model }, { id: 'other-model' }]),
    call: (request: LlmRequest) =>
      Promise.resolve(
        request.images?.length
          ? result({
              transcript:
                'Họ và tên: Nguyễn Thị Hương Số tiền: 495.253.647 đồng',
            })
          : result({ status: 'READY', items: ['a'], note: null }),
      ),
  };
}

run('LlmProvidersService on PostgreSQL', () => {
  let db: PrismaClient;
  let service: LlmProvidersService;
  let audit: { log: jest.Mock };
  let failNext: LlmError | null = null;
  let factoryCalls = 0;
  const tag = `llm-${randomUUID().slice(0, 8)}`;

  const factory = {
    create: (settings: ProviderSettings) => {
      factoryCalls += 1;
      return scriptedProvider(settings, failNext);
    },
  } as unknown as LlmProviderFactory;

  const input = (overrides: Record<string, unknown> = {}) => ({
    kind: 'ANTHROPIC' as const,
    label: tag,
    model: 'claude-haiku-5-5',
    apiKey: PLAIN_KEY,
    dataRegion: 'US',
    zeroRetention: true,
    ...overrides,
  });

  const assessment = () =>
    service.createAssessment(
      { fileNumber: `${tag}-DGTD`, filedAt: new Date('2026-11-01') },
      ACTOR,
    );

  const wipe = async () => {
    await db.llmProvider.deleteMany({ where: { label: { startsWith: tag } } });
    await db.llmTransferAssessment.deleteMany({});
  };

  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== '127.0.0.1' ||
      parsed.pathname !== '/pc02_goiy_scope_test'
    ) {
      throw new Error(
        'Refused: PETITION_SUGGEST_DATABASE_URL must point to 127.0.0.1/pc02_goiy_scope_test',
      );
    }
    process.env.LLM_KEY_ENCRYPTION_KEY = 'a'.repeat(64);
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url! }),
    });
    await wipe();
  });

  beforeEach(() => {
    failNext = null;
    factoryCalls = 0;
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new LlmProvidersService(
      db as unknown as PrismaService,
      new LlmKeyService(),
      audit as unknown as AuditService,
      factory,
    );
  });

  afterEach(wipe);
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });

  const storedRow = (id: string) =>
    db.llmProvider.findUniqueOrThrow({ where: { id } });

  it('stores the key encrypted, keeps only the last four characters, and never returns the key', async () => {
    const view = await service.create(input(), ACTOR);
    const row = await storedRow(view.id);
    expect(row.apiKeyEncrypted.startsWith('v1:')).toBe(true);
    expect(row.apiKeyEncrypted).not.toContain(PLAIN_KEY);
    expect(row.apiKeyLast4).toBe('6789');
    expect(row.role).toBe('OFF');
    expect(JSON.stringify(view)).not.toContain(PLAIN_KEY);
    expect(Object.keys(view)).not.toContain('apiKey');
    expect(Object.keys(view)).not.toContain('apiKeyEncrypted');
  });

  it('writes an audit entry that never contains the key', async () => {
    await service.create(input(), ACTOR);
    expect(audit.log).toHaveBeenCalledTimes(1);
    const [entry] = audit.log.mock.calls[0] as [unknown];
    expect(JSON.stringify(entry)).not.toContain(PLAIN_KEY);
  });

  it('rejects invalid input with a stable code and the violations', async () => {
    const error = await service
      .create(input({ label: ' ', apiKey: 'x' }), ACTOR)
      .catch(
        (e: { getResponse(): { code: string; violations: unknown[] } }) => e,
      );
    const body = (
      error as {
        getResponse(): { code: string; violations: Array<{ code: string }> };
      }
    ).getResponse();
    expect(body.code).toBe('LLM_PROVIDER_INVALID');
    expect(body.violations.map((v) => v.code).sort()).toEqual([
      'API_KEY_INVALID',
      'LABEL_REQUIRED',
    ]);
  });

  it('a passing test records the result and vouches for the current values', async () => {
    const created = await service.create(input(), ACTOR);
    const report = await service.test(created.id, ACTOR);
    expect(report.ok).toBe(true);
    const view = (await service.list()).find((v) => v.id === created.id)!;
    expect(view.test).toMatchObject({ ok: true, current: true });
    expect((await storedRow(created.id)).testedFingerprint).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it('a failing test records the failure and takes the role away', async () => {
    const created = await service.create(
      input({ kind: 'SELF_HOSTED', baseUrl: 'http://10.0.0.5:8000' }),
      ACTOR,
    );
    await service.test(created.id, ACTOR);
    await service.setRole(created.id, { role: 'PRIMARY' }, ACTOR);

    failNext = new LlmError('AUTH', 'rejected', { retryable: false });
    const report = await service.test(created.id, ACTOR);
    expect(report.ok).toBe(false);
    const row = await storedRow(created.id);
    expect(row.role).toBe('OFF');
    expect(row.testedFingerprint).toBeNull();
    expect(row.lastTestOk).toBe(false);
    expect(row.lastTestCode).toBe('AUTH');
  });

  it('refuses a role until the provider has passed a test', async () => {
    const created = await service.create(
      input({ kind: 'SELF_HOSTED', baseUrl: 'http://10.0.0.5:8000' }),
      ACTOR,
    );
    const error = await service
      .setRole(created.id, { role: 'PRIMARY' }, ACTOR)
      .catch((e: unknown) => e);
    expect(
      (error as { getResponse(): { reason: string } }).getResponse().reason,
    ).toBe('NOT_TESTED');
  });

  it('refuses a cloud role without a transfer assessment, and allows it once one is filed', async () => {
    const created = await service.create(input(), ACTOR);
    await service.test(created.id, ACTOR);
    const blocked = await service
      .setRole(created.id, { role: 'PRIMARY' }, ACTOR)
      .catch((e: unknown) => e);
    expect(
      (blocked as { getResponse(): { reason: string } }).getResponse().reason,
    ).toBe('TRANSFER_ASSESSMENT_REQUIRED');

    await assessment();
    const view = await service.setRole(created.id, { role: 'PRIMARY' }, ACTOR);
    expect(view.role).toBe('PRIMARY');
  });

  it('a new PRIMARY demotes the old one to FALLBACK without breaking the one-primary rule', async () => {
    await assessment();
    const a = await service.create(input({ label: `${tag}-a` }), ACTOR);
    const b = await service.create(input({ label: `${tag}-b` }), ACTOR);
    await service.test(a.id, ACTOR);
    await service.test(b.id, ACTOR);
    await service.setRole(a.id, { role: 'PRIMARY' }, ACTOR);
    await service.setRole(b.id, { role: 'PRIMARY' }, ACTOR);
    expect((await storedRow(a.id)).role).toBe('FALLBACK');
    expect((await storedRow(b.id)).role).toBe('PRIMARY');
  });

  it('changing the model or the key invalidates the test and drops the role; a label change does not', async () => {
    const created = await service.create(
      input({ kind: 'SELF_HOSTED', baseUrl: 'http://10.0.0.5:8000' }),
      ACTOR,
    );
    await service.test(created.id, ACTOR);
    await service.setRole(created.id, { role: 'PRIMARY' }, ACTOR);

    await service.update(created.id, { label: `${tag}-renamed` }, ACTOR);
    expect((await storedRow(created.id)).role).toBe('PRIMARY');

    await service.update(created.id, { model: 'other-model' }, ACTOR);
    let row = await storedRow(created.id);
    expect(row.role).toBe('OFF');
    expect(row.testedFingerprint).toBeNull();

    await service.test(created.id, ACTOR);
    await service.setRole(created.id, { role: 'PRIMARY' }, ACTOR);
    await service.update(
      created.id,
      { apiKey: 'sk-ant-NEW-KEY-987654321' },
      ACTOR,
    );
    row = await storedRow(created.id);
    expect(row.role).toBe('OFF');
    expect(row.apiKeyLast4).toBe('4321');
  });

  it('withdrawing the transfer assessment takes cloud providers out of service at once, not self-hosted ones', async () => {
    await assessment();
    const cloud = await service.create(input({ label: `${tag}-cloud` }), ACTOR);
    const own = await service.create(
      input({
        label: `${tag}-own`,
        kind: 'SELF_HOSTED',
        baseUrl: 'http://10.0.0.5:8000',
      }),
      ACTOR,
    );
    for (const p of [cloud, own]) await service.test(p.id, ACTOR);
    await service.setRole(cloud.id, { role: 'PRIMARY' }, ACTOR);
    await service.setRole(own.id, { role: 'FALLBACK' }, ACTOR);

    await service.withdrawAssessment(ACTOR);
    expect((await storedRow(cloud.id)).role).toBe('OFF');
    expect((await storedRow(own.id)).role).toBe('FALLBACK');
    expect(await service.activeAssessment()).toBeNull();
  });

  it('archive removes the role and blocks a new one; restore does not give it back; delete needs role OFF', async () => {
    const created = await service.create(
      input({ kind: 'SELF_HOSTED', baseUrl: 'http://10.0.0.5:8000' }),
      ACTOR,
    );
    await service.test(created.id, ACTOR);
    await service.setRole(created.id, { role: 'FALLBACK' }, ACTOR);

    const inUse = await service
      .remove(created.id, ACTOR)
      .catch((e: unknown) => e);
    expect(
      (inUse as { getResponse(): { code: string } }).getResponse().code,
    ).toBe('LLM_PROVIDER_IN_USE');

    await service.archive(created.id, ACTOR);
    let row = await storedRow(created.id);
    expect(row.archivedAt).not.toBeNull();
    expect(row.role).toBe('OFF');
    const blocked = await service
      .setRole(created.id, { role: 'FALLBACK' }, ACTOR)
      .catch((e: unknown) => e);
    expect(
      (blocked as { getResponse(): { reason: string } }).getResponse().reason,
    ).toBe('ARCHIVED');

    await service.restore(created.id, ACTOR);
    row = await storedRow(created.id);
    expect(row.archivedAt).toBeNull();
    expect(row.role).toBe('OFF');

    await service.remove(created.id, ACTOR);
    expect(
      await db.llmProvider.findUnique({ where: { id: created.id } }),
    ).toBeNull();
  });

  it('buildChain returns PRIMARY then FALLBACKs by order, skipping archived, OFF and cloud without an assessment', async () => {
    await assessment();
    const names = ['p', 'f2', 'f1', 'off'];
    const made: Record<string, string> = {};
    for (const n of names) {
      made[n] = (
        await service.create(
          input({ label: `${tag}-${n}`, model: `model-${n}` }),
          ACTOR,
        )
      ).id;
      await service.test(made[n], ACTOR);
    }
    await service.setRole(made.p, { role: 'PRIMARY' }, ACTOR);
    await service.setRole(
      made.f2,
      { role: 'FALLBACK', fallbackOrder: 2 },
      ACTOR,
    );
    await service.setRole(
      made.f1,
      { role: 'FALLBACK', fallbackOrder: 1 },
      ACTOR,
    );

    expect((await service.buildChain()).map((p) => p.model)).toEqual([
      'model-p',
      'model-f1',
      'model-f2',
    ]);

    await service.withdrawAssessment(ACTOR);
    expect(await service.buildChain()).toEqual([]);
  });

  it('lists the models of unsaved values, and of a saved provider, without exposing the key', async () => {
    const draft = await service.listModelsDraft({
      kind: 'ANTHROPIC',
      apiKey: PLAIN_KEY,
    });
    expect(draft.map((m) => m.id)).toContain('other-model');

    const created = await service.create(input(), ACTOR);
    const saved = await service.listModels(created.id);
    expect(saved.map((m) => m.id)).toContain('other-model');
    expect(JSON.stringify(saved)).not.toContain(PLAIN_KEY);
  });

  it('turns a provider failure while listing into a stable admin error naming the cause', async () => {
    failNext = new LlmError('AUTH', 'rejected', { retryable: false });
    const error = await service
      .listModelsDraft({ kind: 'ANTHROPIC', apiKey: PLAIN_KEY })
      .catch((e: unknown) => e);
    const body = (
      error as { getResponse(): { code: string; cause: string } }
    ).getResponse();
    expect(body.code).toBe('LLM_PROVIDER_CALL_FAILED');
    expect(body.cause).toBe('AUTH');
  });

  it('testDraft tests unsaved values without writing anything', async () => {
    const before = await db.llmProvider.count({
      where: { label: { startsWith: tag } },
    });
    const report = await service.testDraft(input(), ACTOR);
    expect(report.ok).toBe(true);
    expect(factoryCalls).toBe(1);
    expect(
      await db.llmProvider.count({ where: { label: { startsWith: tag } } }),
    ).toBe(before);
  });
});
