import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../prisma/prisma.service';
import type { SettingsService } from '../settings/settings.service';
import { LlmGatewayService } from './llm-gateway.service';
import type { ChainEntry, LlmProvidersService } from './llm-providers.service';
import { LlmExhaustedError } from './call-policy';
import type { TokenPrices } from './cost';
import {
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
} from './llm.types';

/**
 * LlmGatewayService on REAL PostgreSQL: limits, cost accounting and lineage.
 * Runs only with `PETITION_SUGGEST_DATABASE_URL` (127.0.0.1/pc02_goiy_scope_test); CI makes a missing database a failure.
 */
const url = process.env.PETITION_SUGGEST_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.PETITION_SUGGEST_DATABASE_REQUIRED === '1') {
  it('the scratch database is mandatory (PETITION_SUGGEST_DATABASE_URL)', () => {
    expect(url).toBeTruthy();
  });
}

const PRIVATE_TEXT = 'PRIVATE CCCD 079190012345';

const request = (images = 1): LlmRequest => ({
  system: 's',
  userText: PRIVATE_TEXT,
  images: Array.from({ length: images }, () => ({
    mediaType: 'image/png' as const,
    dataBase64: 'AAAA',
  })),
  schemaName: 'x',
  schema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  maxOutputTokens: 10,
});

const accept = (json: unknown) => ({ ok: true as const, value: json });

type Step = LlmResult | LlmError;

function scripted(model: string, steps: Step[]): LlmProvider {
  let calls = 0;
  return {
    kind: 'ANTHROPIC',
    model,
    listModels: () => Promise.resolve([]),
    call() {
      const step = steps[Math.min(calls, steps.length - 1)];
      calls += 1;
      return step instanceof LlmError
        ? Promise.reject(step)
        : Promise.resolve(step);
    },
  };
}

const ok = (model: string, input = 1000, output = 200): LlmResult => ({
  json: { done: true },
  usage: { inputTokens: input, outputTokens: output },
  latencyMs: 25,
  model,
  providerKind: 'ANTHROPIC',
});

run('LlmGatewayService on PostgreSQL', () => {
  let db: PrismaClient;
  const tag = `gw-${randomUUID().slice(0, 8)}`;
  const userId = `user-${tag}`;
  let chain: ChainEntry[] = [];
  let settings: Record<string, number> = {};
  const delays: number[] = [];
  /** Providers an administrator has switched off or withdrawn the assessment for, as the gateway re-checks them. */
  const withdrawn = new Set<string>();
  let onSleep: (() => void) | null = null;

  const entry = (
    provider: LlmProvider,
    prices: TokenPrices = {
      inputMicroUsdPerMTok: 1_000_000,
      outputMicroUsdPerMTok: 5_000_000,
    },
  ): ChainEntry => ({
    id: `prov-${provider.model}`,
    dataRegion: 'US',
    prices,
    provider,
  });

  const gateway = () =>
    new LlmGatewayService(
      db as unknown as PrismaService,
      {
        buildChainEntries: () => Promise.resolve(chain),
        isEligible: (id: string) => Promise.resolve(!withdrawn.has(id)),
      } as unknown as LlmProvidersService,
      {
        getNumericValue: (key: string, fallback: number) =>
          Promise.resolve(settings[key] ?? fallback),
      } as unknown as SettingsService,
      (ms: number) => {
        delays.push(ms);
        onSleep?.();
        return Promise.resolve();
      },
    );

  const context = { userId, sessionRef: tag, promptVersion: 'analysis.v1' };
  const lineage = () =>
    db.llmCallLineage.findMany({
      where: { sessionRef: tag },
      orderBy: { createdAt: 'asc' },
    });

  const seedLineage = (data: {
    outcome?: string;
    imagesSent?: number;
    cost?: number;
    at?: Date;
    user?: string;
  }) =>
    db.llmCallLineage.create({
      data: {
        sessionRef: `${tag}-seed`,
        userId: data.user ?? userId,
        providerKind: 'ANTHROPIC',
        model: 'seed',
        outcome: data.outcome ?? 'OK',
        imagesSent: data.imagesSent ?? 0,
        estimatedCostMicroUsd: data.cost ?? 0,
        ...(data.at ? { createdAt: data.at } : {}),
      },
    });

  beforeAll(() => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== '127.0.0.1' ||
      parsed.pathname !== '/pc02_goiy_scope_test'
    ) {
      throw new Error(
        'Refused: PETITION_SUGGEST_DATABASE_URL must point to 127.0.0.1/pc02_goiy_scope_test',
      );
    }
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url! }),
    });
  });

  beforeEach(() => {
    chain = [entry(scripted('m1', [ok('m1')]))];
    settings = {};
    delays.length = 0;
    withdrawn.clear();
    onSleep = null;
  });

  const wipe = () =>
    db.llmCallLineage.deleteMany({
      where: { sessionRef: { startsWith: tag } },
    });
  afterEach(wipe);
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });

  it('writes one lineage row per attempt, with tokens, cost and images, and never any content', async () => {
    const out = await gateway().call(request(2), accept, context);
    expect(out.result.model).toBe('m1');
    const rows = await lineage();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId,
      providerId: 'prov-m1',
      providerKind: 'ANTHROPIC',
      model: 'm1',
      dataRegion: 'US',
      outcome: 'OK',
      inputTokens: 1000,
      outputTokens: 200,
      imagesSent: 2,
      estimatedCostMicroUsd: 1000 + 1000,
      promptVersion: 'analysis.v1',
    });
    expect(JSON.stringify(rows)).not.toContain('079190012345');
  });

  it('records failed attempts too, and a retried call still ends in a success row', async () => {
    chain = [
      entry(
        scripted('m1', [
          new LlmError('RATE_LIMIT', 'slow', {
            retryable: true,
            retryAfterMs: 10,
          }),
          ok('m1'),
        ]),
      ),
    ];
    await gateway().call(request(1), accept, context);
    expect((await lineage()).map((r) => r.outcome)).toEqual([
      'RATE_LIMIT',
      'OK',
    ]);
    expect(delays).toEqual([10]);
  });

  it('does not retry on a provider that stopped being allowed while the call was waiting', async () => {
    const first = scripted('m1', [
      new LlmError('RATE_LIMIT', 'slow', { retryable: true, retryAfterMs: 10 }),
      ok('m1'),
    ]);
    const spy = jest.spyOn(first, 'call');
    chain = [entry(first), entry(scripted('m2', [ok('m2')]))];
    // During the wait before the retry, the transfer assessment is withdrawn for the first provider.
    onSleep = () => withdrawn.add('prov-m1');

    const out = await gateway().call(request(1), accept, context);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(out.result.model).toBe('m2');
  });

  it('records every attempt and rethrows when all providers fail', async () => {
    chain = [
      entry(
        scripted('m1', [new LlmError('SERVER', 'boom', { retryable: true })]),
      ),
    ];
    await expect(
      gateway().call(request(1), accept, context),
    ).rejects.toBeInstanceOf(LlmExhaustedError);
    expect((await lineage()).map((r) => r.outcome)).toEqual([
      'SERVER',
      'SERVER',
      'SERVER',
    ]);
  });

  it('leaves the cost unknown (null) when the provider has no prices', async () => {
    chain = [
      entry(scripted('m1', [ok('m1')]), {
        inputMicroUsdPerMTok: null,
        outputMicroUsdPerMTok: null,
      }),
    ];
    await gateway().call(request(1), accept, context);
    expect((await lineage())[0].estimatedCostMicroUsd).toBeNull();
  });

  it('refuses when no provider is usable', async () => {
    chain = [];
    const error = await gateway()
      .call(request(1), accept, context)
      .catch((e: unknown) => e);
    expect(
      (error as { getResponse(): { code: string } }).getResponse().code,
    ).toBe('LLM_NO_PROVIDER');
  });

  describe('per-user daily image quota', () => {
    beforeEach(() => {
      settings = { LLM_QUOTA_IMAGES_PER_USER_DAY: 10 };
    });

    it('allows a call that fits and refuses one that would exceed the limit', async () => {
      await seedLineage({ imagesSent: 9 });
      await expect(
        gateway().call(request(1), accept, context),
      ).resolves.toBeDefined();
      const error = await gateway()
        .call(request(2), accept, context)
        .catch((e: unknown) => e);
      const body = (
        error as {
          getResponse(): { code: string; limit: number; used: number };
        }
      ).getResponse();
      expect(body).toMatchObject({
        code: 'LLM_QUOTA_EXCEEDED',
        limit: 10,
        used: 10,
      });
    });

    it('counts only successful attempts, so a flaky provider does not eat the quota', async () => {
      await seedLineage({ imagesSent: 50, outcome: 'SERVER' });
      await expect(
        gateway().call(request(2), accept, context),
      ).resolves.toBeDefined();
    });

    it('is per user and per Vietnam day', async () => {
      await seedLineage({ imagesSent: 50, user: 'someone-else' });
      await seedLineage({
        imagesSent: 50,
        at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      });
      await expect(
        gateway().call(request(5), accept, context),
      ).resolves.toBeDefined();
    });

    it('a call without images never touches the image quota', async () => {
      await seedLineage({ imagesSent: 10 });
      await expect(
        gateway().call(request(0), accept, context),
      ).resolves.toBeDefined();
    });
  });

  describe('monthly cost cap', () => {
    beforeEach(() => {
      settings = { LLM_BUDGET_MONTH_MICRO_USD: 10_000 };
    });

    it('stops all calls once the month has spent the cap', async () => {
      await seedLineage({ cost: 10_000 });
      const error = await gateway()
        .call(request(1), accept, context)
        .catch((e: unknown) => e);
      expect(
        (error as { getResponse(): { code: string } }).getResponse().code,
      ).toBe('LLM_BUDGET_EXHAUSTED');
      expect(await lineage()).toHaveLength(0);
    });

    it('still allows calls at 80 percent and reports the warning level', async () => {
      await seedLineage({ cost: 7_000 }); // plus the 2,000 this call costs = 9,000 = 90 percent
      await expect(
        gateway().call(request(1), accept, context),
      ).resolves.toBeDefined();
      const status = await gateway().budgetStatus();
      expect(status.level).toBe('WARN');
      expect(status.usedMicroUsd).toBe(9_000);
      expect(status.capMicroUsd).toBe(10_000);
    });

    it('a cap of 0 means unlimited', async () => {
      settings = { LLM_BUDGET_MONTH_MICRO_USD: 0 };
      await seedLineage({ cost: 10 ** 9 });
      await expect(
        gateway().call(request(1), accept, context),
      ).resolves.toBeDefined();
    });
  });
});
