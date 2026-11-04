import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../prisma/prisma.service';
import type { LlmGatewayService } from '../../llm/llm-gateway.service';
import { OcrQualityService } from './ocr-quality.service';

/** Quality and cost statistics over real PostgreSQL rows. Runs only with `PETITION_SUGGEST_DATABASE_URL`. */
const url = process.env.PETITION_SUGGEST_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.PETITION_SUGGEST_DATABASE_REQUIRED === '1') {
  it('the scratch database is mandatory (PETITION_SUGGEST_DATABASE_URL)', () => {
    expect(url).toBeTruthy();
  });
}

run('OcrQualityService on PostgreSQL', () => {
  let db: PrismaClient;
  let service: OcrQualityService;
  const tag = `qual-${randomUUID().slice(0, 8)}`;
  const day = new Date('2026-11-03T05:00:00Z');
  const window = {
    from: new Date('2026-11-01T00:00:00Z'),
    to: new Date('2026-11-30T00:00:00Z'),
  };

  const outcome = (
    field: string,
    kind: 'KEPT' | 'EDITED' | 'CLEARED',
    model = 'm1',
    mustConfirm = false,
  ) => ({
    sessionId: `${tag}-s`,
    entity: 'PETITION' as const,
    field,
    outcome: kind,
    mustConfirm,
    providerKind: 'GEMINI' as const,
    model,
    promptVersion: 'analyse.v1',
    createdAt: day,
  });
  const call = (model: string, result: string, cost: number, images = 0) => ({
    sessionRef: `${tag}-s`,
    providerKind: 'GEMINI' as const,
    model,
    outcome: result,
    inputTokens: 100,
    outputTokens: 10,
    estimatedCostMicroUsd: cost,
    imagesSent: images,
    createdAt: day,
  });

  const wipe = async () => {
    await db.ocrFieldOutcome.deleteMany({
      where: { sessionId: { startsWith: tag } },
    });
    await db.llmCallLineage.deleteMany({
      where: { sessionRef: { startsWith: tag } },
    });
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
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url! }),
    });
    service = new OcrQualityService(db as unknown as PrismaService);
    await wipe();
  });
  afterEach(wipe);
  afterAll(async () => {
    await wipe();
    await db.$disconnect();
  });

  it('counts, per field and model, how often the officer kept, changed or emptied what was read', async () => {
    await db.ocrFieldOutcome.createMany({
      data: [
        outcome('senderName', 'KEPT'),
        outcome('senderName', 'KEPT'),
        outcome('senderName', 'EDITED'),
        outcome('senderPhone', 'CLEARED'),
        outcome('senderName', 'KEPT', 'm2'),
      ],
    });
    const report = await service.report(window, tag);
    const row = (field: string, model: string) =>
      report.fields.find((f) => f.field === field && f.model === model);
    expect(row('senderName', 'm1')).toMatchObject({
      kept: 2,
      edited: 1,
      cleared: 0,
      total: 3,
      entity: 'PETITION',
    });
    expect(row('senderPhone', 'm1')).toMatchObject({
      kept: 0,
      edited: 0,
      cleared: 1,
      total: 1,
    });
    expect(row('senderName', 'm2')).toMatchObject({ kept: 1, total: 1 });
  });

  it('adds up calls, failures, images, tokens and estimated cost per provider and model', async () => {
    await db.llmCallLineage.createMany({
      data: [
        call('m1', 'OK', 2000, 3),
        call('m1', 'OK', 3000, 2),
        call('m1', 'RATE_LIMIT', 0),
        call('m2', 'OK', 500, 1),
      ],
    });
    const report = await service.report(window, tag);
    const m1 = report.calls.find((c) => c.model === 'm1')!;
    expect(m1).toMatchObject({
      calls: 3,
      ok: 2,
      failed: 1,
      images: 5,
      inputTokens: 300,
      outputTokens: 30,
      costMicroUsd: 5000,
    });
    expect(m1.errors).toEqual({ RATE_LIMIT: 1 });
    expect(report.calls.find((c) => c.model === 'm2')).toMatchObject({
      calls: 1,
      ok: 1,
      costMicroUsd: 500,
    });
  });

  it('reports where the month stands against the spending cap, so a warning is visible before calls stop', async () => {
    const withBudget = new OcrQualityService(
      db as unknown as PrismaService,
      {
        budgetStatus: () =>
          Promise.resolve({
            usedMicroUsd: 17_000_000,
            capMicroUsd: 20_000_000,
            level: 'WARN' as const,
          }),
      } as unknown as LlmGatewayService,
    );
    const report = await withBudget.report(window, tag);
    expect(report.budget).toEqual({
      usedMicroUsd: 17_000_000,
      capMicroUsd: 20_000_000,
      level: 'WARN',
    });
    // and nothing is claimed when no budget source is wired
    expect((await service.report(window, tag)).budget).toBeNull();
  });

  it('only counts what falls inside the period', async () => {
    await db.ocrFieldOutcome.create({
      data: {
        ...outcome('senderName', 'KEPT'),
        createdAt: new Date('2026-09-01T00:00:00Z'),
      },
    });
    await db.llmCallLineage.create({
      data: {
        ...call('m1', 'OK', 100),
        createdAt: new Date('2026-09-01T00:00:00Z'),
      },
    });
    const report = await service.report(window, tag);
    expect(report.fields).toEqual([]);
    expect(report.calls).toEqual([]);
  });

  it('carries no value: only names, outcomes and counts', async () => {
    await db.ocrFieldOutcome.create({ data: outcome('senderName', 'KEPT') });
    expect(
      Object.keys((await service.report(window, tag)).fields[0]).sort(),
    ).toEqual(
      [
        'cleared',
        'edited',
        'entity',
        'field',
        'kept',
        'mustConfirm',
        'model',
        'promptVersion',
        'providerKind',
        'total',
      ].sort(),
    );
  });
});
