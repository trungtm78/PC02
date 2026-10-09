import * as fs from 'fs';
import * as path from 'path';
import Decimal from 'decimal.js';
import { aggregateValues } from './aggregate';
import type { Contribution } from './aggregate';
import { evaluateFormula } from './expr';
import type { EvalContext, CellReference, CellResolution } from './expr';

/**
 * Aggregate engine — combines per-source (per-team) values into one number
 * per field, per FRD §4.5/D03. Pure, no I/O. Validated both against the
 * FRD's own worked examples (AGG01, RATE01) and, more importantly, against
 * an INDEPENDENT oracle computed outside this codebase from the real HSLN
 * workbook (spec §8, §10 R11) — the workbook's own cached TỔNG values are
 * NOT used as the oracle, because 190/228 of them are already stale
 * `#REF!` (the Tổ 10 sheet is upstream-corrupted); the oracle instead sums
 * the 16 unit sheets directly with plain arithmetic.
 */

function contrib(values: (number | null)[]): Contribution[] {
  return values.map((value, i) => ({ sourceId: `s${i}`, value }));
}

describe('aggregateValues — AGG01 (FRD §4.5: "A2 của ba người là 10, 0, null")', () => {
  const values = contrib([10, 0, null]);

  it("blankPolicy=IGNORE: SUM=10, AVG=5, COUNT=2 (FRD's base example — null excluded entirely)", () => {
    expect(aggregateValues('SUM', 'IGNORE', values).value).toBe(10);
    expect(aggregateValues('AVG', 'IGNORE', values).value).toBe(5);
    expect(aggregateValues('COUNT', 'IGNORE', values).value).toBe(2);
  });

  it('blankPolicy=ZERO (D03 default): SUM=10, AVG=10/3, COUNT=3 (null treated as 0, so it counts)', () => {
    expect(aggregateValues('SUM', 'ZERO', values).value).toBe(10);
    const avg = aggregateValues('AVG', 'ZERO', values).value;
    expect(avg).not.toBeNull();
    expect(
      new Decimal(avg as number).toDecimalPlaces(4).toNumber(),
    ).toBeCloseTo(10 / 3, 4);
    expect(aggregateValues('COUNT', 'ZERO', values).value).toBe(3);
  });

  it('MIN/MAX under IGNORE policy (10, 0, null -> min 0, max 10)', () => {
    expect(aggregateValues('MIN', 'IGNORE', values).value).toBe(0);
    expect(aggregateValues('MAX', 'IGNORE', values).value).toBe(10);
  });

  it('records every contributor for drill-down (S18), including the blank one', () => {
    const result = aggregateValues('SUM', 'IGNORE', values);
    expect(result.contributors).toEqual(values);
    expect(result.countTotal).toBe(3);
    expect(result.countNonBlank).toBe(2);
  });
});

describe('aggregateValues — empty set and NONE', () => {
  it('SUM/AVG/MIN/MAX on an empty contribution list is null ("—"), not 0', () => {
    expect(aggregateValues('SUM', 'IGNORE', []).value).toBeNull();
    expect(aggregateValues('AVG', 'IGNORE', []).value).toBeNull();
    expect(aggregateValues('MIN', 'IGNORE', []).value).toBeNull();
    expect(aggregateValues('MAX', 'IGNORE', []).value).toBeNull();
  });

  it('COUNT on an empty contribution list is 0, not "—"', () => {
    expect(aggregateValues('COUNT', 'IGNORE', []).value).toBe(0);
  });

  it('SUM/AVG/MIN/MAX on an all-blank set under IGNORE is null ("—")', () => {
    const allBlank = contrib([null, null, null]);
    expect(aggregateValues('SUM', 'IGNORE', allBlank).value).toBeNull();
    expect(aggregateValues('AVG', 'IGNORE', allBlank).value).toBeNull();
  });

  it('NONE aggregate type never computes a number — always "not aggregated" (FRD: "— / Không tổng hợp")', () => {
    const result = aggregateValues('NONE', 'IGNORE', contrib([10, 20]));
    expect(result.value).toBeNull();
    expect(result.displayNotAggregated).toBe(true);
  });
});

describe('aggregateValues — RATE01 (FRD: tỷ lệ chung từ tử/mẫu tổng, không phải trung bình đơn giản)', () => {
  it('computes the combined rate from aggregated numerator/denominator, not the average of per-team rates', () => {
    // Team A: processed 9 of 10. Team B: processed 1 of 90.
    const processed = aggregateValues('SUM', 'IGNORE', contrib([9, 1]));
    const received = aggregateValues('SUM', 'IGNORE', contrib([10, 90]));
    expect(processed.value).toBe(10);
    expect(received.value).toBe(100);

    // Tier-3 formula on the aggregate sheet: rate = processed / received,
    // evaluated via the expr engine reading the already-aggregated cells —
    // this is the "two-tier" composition: aggregate first, then formula.
    const ctx: EvalContext = {
      resolveCell(ref: CellReference): CellResolution {
        // Cell references must look like spreadsheet addresses (letters +
        // digits) per the expr grammar — A1 stands in for "processed",
        // A2 for "received" on the aggregate sheet.
        if (ref.cell === 'A1')
          return { kind: 'value', value: processed.value as number };
        if (ref.cell === 'A2')
          return { kind: 'value', value: received.value as number };
        return { kind: 'not_found' };
      },
      expandRange: () => [],
      prevValue: () => ({ kind: 'none' }),
    };
    const result = evaluateFormula('A1/A2', ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number') {
      expect(result.value.value.toNumber()).toBe(0.1); // 10% — NOT (0.9+0.0111)/2 ≈ 45.6%
    }
  });
});

describe('aggregateValues — independent HSLN oracle (spec §10 R11)', () => {
  const oraclePath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'test',
    'fixtures',
    'dynamic-reports',
    'real',
    'hsln-oracle.json',
  );
  const oracle = JSON.parse(fs.readFileSync(oraclePath, 'utf-8')) as {
    rows: {
      address: string;
      supported3DSum: boolean;
      perSheetValues: Record<string, number | string | null>;
      sumIgnoringBlanks: number | null;
      cachedIsRef: boolean;
    }[];
  };

  it('loaded a non-trivial oracle fixture', () => {
    expect(oracle.rows.length).toBeGreaterThan(100);
  });

  it('aggregateValues(SUM, IGNORE) matches the independent oracle for every supported 3-D-sum row, including the 190 rows the workbook itself got wrong (#REF!)', () => {
    const supportedRows = oracle.rows.filter((r) => r.supported3DSum);
    expect(supportedRows.length).toBeGreaterThan(0);

    let checked = 0;
    for (const row of supportedRows) {
      const contributions: Contribution[] = Object.entries(
        row.perSheetValues,
      ).map(([sheet, v]) => ({
        sourceId: sheet,
        value: typeof v === 'number' ? v : null, // non-numeric cached values (incl. "#REF!" strings) are not real numbers
      }));
      const result = aggregateValues('SUM', 'IGNORE', contributions);
      const expected = row.sumIgnoringBlanks;
      if (expected === null) {
        expect(result.value).toBeNull();
      } else {
        expect(result.value).toBe(expected);
      }
      checked++;
    }
    expect(checked).toBe(supportedRows.length);
  });

  it("demonstrates the oracle disagrees with the workbook's own (stale) cache on the known-broken rows", () => {
    const brokenRows = oracle.rows.filter(
      (r) => r.supported3DSum && r.cachedIsRef,
    );
    expect(brokenRows.length).toBe(190);
    // Every one of these has a real, computable independent sum (or a
    // defensible null) even though Excel itself gave up with #REF!.
    for (const row of brokenRows.slice(0, 5)) {
      const contributions: Contribution[] = Object.entries(
        row.perSheetValues,
      ).map(([sheet, v]) => ({
        sourceId: sheet,
        value: typeof v === 'number' ? v : null,
      }));
      const result = aggregateValues('SUM', 'IGNORE', contributions);
      expect(result.value).toBe(row.sumIgnoringBlanks);
    }
  });
});
