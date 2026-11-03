import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface Period {
  from: Date;
  to: Date;
}

export interface FieldQualityRow {
  entity: string;
  field: string;
  providerKind: string | null;
  model: string | null;
  promptVersion: string | null;
  kept: number;
  edited: number;
  cleared: number;
  total: number;
  /** How many of these were fields the officer had to confirm. */
  mustConfirm: number;
}

export interface CallCostRow {
  providerKind: string;
  model: string;
  calls: number;
  ok: number;
  failed: number;
  images: number;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  /** Failures by the code the attempt ended with. */
  errors: Record<string, number>;
}

/**
 * Statistics for choosing a model and a prompt: how often officers keep what was read, and what it costs. Counts and
 * names only; nothing read from a scan is stored or returned. `sessionPrefix` narrows to one test's rows.
 */
@Injectable()
export class OcrQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async report(
    period: Period,
    sessionPrefix?: string,
  ): Promise<{
    period: Period;
    fields: FieldQualityRow[];
    calls: CallCostRow[];
  }> {
    const createdAt = { gte: period.from, lt: period.to };

    const outcomes = await this.prisma.ocrFieldOutcome.groupBy({
      by: [
        'entity',
        'field',
        'providerKind',
        'model',
        'promptVersion',
        'outcome',
        'mustConfirm',
      ],
      where: {
        createdAt,
        ...(sessionPrefix ? { sessionId: { startsWith: sessionPrefix } } : {}),
      },
      _count: { _all: true },
    });
    const fields = new Map<string, FieldQualityRow>();
    for (const row of outcomes) {
      const key = [
        row.entity,
        row.field,
        row.providerKind,
        row.model,
        row.promptVersion,
      ].join('|');
      const entry = fields.get(key) ?? {
        entity: row.entity,
        field: row.field,
        providerKind: row.providerKind,
        model: row.model,
        promptVersion: row.promptVersion,
        kept: 0,
        edited: 0,
        cleared: 0,
        total: 0,
        mustConfirm: 0,
      };
      const n = row._count._all;
      if (row.outcome === 'KEPT') entry.kept += n;
      else if (row.outcome === 'EDITED') entry.edited += n;
      else entry.cleared += n;
      entry.total += n;
      if (row.mustConfirm) entry.mustConfirm += n;
      fields.set(key, entry);
    }

    const lineage = await this.prisma.llmCallLineage.groupBy({
      by: ['providerKind', 'model', 'outcome'],
      where: {
        createdAt,
        ...(sessionPrefix ? { sessionRef: { startsWith: sessionPrefix } } : {}),
      },
      _count: { _all: true },
      _sum: {
        imagesSent: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCostMicroUsd: true,
      },
    });
    const calls = new Map<string, CallCostRow>();
    for (const row of lineage) {
      const key = `${row.providerKind}|${row.model}`;
      const entry = calls.get(key) ?? {
        providerKind: row.providerKind,
        model: row.model,
        calls: 0,
        ok: 0,
        failed: 0,
        images: 0,
        inputTokens: 0,
        outputTokens: 0,
        costMicroUsd: 0,
        errors: {},
      };
      const n = row._count._all;
      entry.calls += n;
      if (row.outcome === 'OK') entry.ok += n;
      else {
        entry.failed += n;
        entry.errors[row.outcome] = (entry.errors[row.outcome] ?? 0) + n;
      }
      entry.images += row._sum.imagesSent ?? 0;
      entry.inputTokens += row._sum.inputTokens ?? 0;
      entry.outputTokens += row._sum.outputTokens ?? 0;
      entry.costMicroUsd += row._sum.estimatedCostMicroUsd ?? 0;
      calls.set(key, entry);
    }

    return { period, fields: [...fields.values()], calls: [...calls.values()] };
  }
}
