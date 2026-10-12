import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GridModelService } from '../grid/grid-model.service';
import { CALC_ENGINE_VERSION } from '../engine/grid-workbook';
import type { FormulaOutcome } from '../engine/grid-workbook';
import { describeFormulaError } from '../engine/numfmt';
import type { FormulaErrorCode } from '../engine/numfmt';
import { evaluateFormulasInWorker } from '../template/parse-in-worker';

/**
 * The OFFICIAL figures of a template's formulas for a set of values (plan GA1,
 * review OV1/OV10): the aggregate screen, the exported file and a closed
 * period's snapshot all show what this service returns, so the three cannot
 * disagree. The calculation itself runs in the bounded worker.
 *
 * A short in-memory cache keeps a manager who refreshes the summary from paying
 * for the same calculation twice; the key is the whole input, so a hit is
 * always exact.
 */

/** What a client sees for one formula cell. */
export type FormulaCellView =
  | { ok: true; type: 'number' | 'string'; value: string }
  | { ok: true; type: 'boolean'; value: boolean }
  | { ok: false; code: string; text: string };

export type FormulaSource = 'LIVE' | 'FROZEN' | 'UNAVAILABLE';

const CACHE_MAX_ENTRIES = 100;

export function toFormulaView(outcomes: Readonly<Record<string, FormulaOutcome>>): Record<string, FormulaCellView> {
  const out: Record<string, FormulaCellView> = {};
  for (const [key, o] of Object.entries(outcomes)) {
    if (!o.ok) {
      out[key] = { ok: false, code: o.code, text: describeFormulaError(o.code as FormulaErrorCode).text };
    } else if (o.type === 'boolean') {
      out[key] = { ok: true, type: 'boolean', value: o.value };
    } else {
      out[key] = { ok: true, type: o.type, value: o.value };
    }
  }
  return out;
}

@Injectable()
export class FormulaEvaluationService {
  /** Insertion-ordered: the first key is the least recently used. */
  private readonly cache = new Map<string, Record<string, FormulaOutcome>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly grids: GridModelService,
  ) {}

  readonly calcEngineVersion = CALC_ENGINE_VERSION;

  /**
   * @param values  field key → the (aggregated) text, null when there is none
   * @param blankAs `'none'` for aggregates: a missing contribution is reported, never silently 0
   */
  async evaluate(
    versionId: string,
    values: Readonly<Record<string, string | null>>,
    blankAs: 'blank' | 'none',
  ): Promise<Record<string, FormulaOutcome>> {
    const sorted = Object.keys(values)
      .sort()
      .map((k) => [k, values[k]] as const);
    const key = `${versionId}:${blankAs}:${createHash('sha256').update(JSON.stringify(sorted)).digest('hex')}`;
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit;
    }

    const fields = await this.prisma.dynReportField.findMany({
      where: { versionId },
      select: { sheetKey: true, address: true, fieldKey: true, type: true },
    });
    const { model } = await this.grids.getForVersion(versionId);
    const outcomes = await evaluateFormulasInWorker({
      grid: model,
      fields: fields.map((f) => ({
        sheetKey: f.sheetKey,
        address: f.address,
        fieldKey: f.fieldKey,
        type: f.type as 'NUM' | 'TEXT' | 'DATE' | 'TIME',
      })),
      values: { ...values },
      blankAs,
    });

    this.cache.set(key, outcomes);
    while (this.cache.size > CACHE_MAX_ENTRIES) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
    return outcomes;
  }
}
