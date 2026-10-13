import fc from 'fast-check';
import Decimal from 'decimal.js';
import { buildTotalsFormula, FORMULA_GROUP_SIZE, quoteSheetName } from './totals-formulas';
import type { TotalsAggregate, TotalsBlankPolicy } from './totals-formulas';
import { aggregateValues } from '../engine/aggregate';
import { evaluateFormula } from '../engine/expr';
import type { CellResolution } from '../engine/expr';

/**
 * The formula of a totals cell, checked against the aggregate engine — not against itself. Each formula is worked
 * out by the expression engine (a separate implementation of what Excel does with SUM, COUNT, AVERAGE, MIN, MAX, IF)
 * over the teams' numbers, and the answer must be what `aggregateValues` gives for the same numbers: that is the
 * figure the screen shows and the closed period freezes.
 */

const ADDRESS = 'C4';
const AGGREGATES: TotalsAggregate[] = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'];
const POLICIES: TotalsBlankPolicy[] = ['ZERO', 'IGNORE'];

function names(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Đội ${i + 1} (TT)`);
}

/** What Excel (the expression engine) makes of the formula over these teams' cells. null = the formula answers "". */
function work(formula: string, sheetNames: string[], values: Array<string | null>): string | null {
  const bySheet = new Map(sheetNames.map((s, i) => [s, values[i]]));
  const result = evaluateFormula(formula, {
    resolveCell: (ref): CellResolution => {
      const v = bySheet.get(ref.sheet ?? '');
      if (ref.cell !== ADDRESS || v === undefined) return { kind: 'not_found' };
      return v === null ? { kind: 'blank' } : { kind: 'value', value: v };
    },
    expandRange: () => [],
    prevValue: () => ({ kind: 'none' }),
  });
  if (!result.ok) throw new Error(`${formula} -> ${result.error.code}`);
  if (result.value.type === 'string') return result.value.value === '' ? null : result.value.value;
  if (result.value.type !== 'number') throw new Error('not a number');
  return result.value.value.toFixed();
}

function expected(aggregate: TotalsAggregate, policy: TotalsBlankPolicy, values: Array<string | null>): string | null {
  return aggregateValues(
    aggregate,
    policy,
    values.map((value, i) => ({ sourceId: String(i), value })),
  ).value;
}

function same(actual: string | null, wanted: string | null): boolean {
  if (actual === null || wanted === null) return actual === wanted;
  // The system keeps 12 decimals of an average; Excel keeps more.
  return new Decimal(actual).toDecimalPlaces(12).eq(new Decimal(wanted).toDecimalPlaces(12));
}

describe('buildTotalsFormula — the formula works out what the aggregate engine says', () => {
  const CASES: Array<[string, Array<string | null>]> = [
    ['one team', ['7']],
    ['several teams', ['10', '20', '5']],
    ['a blank among them', ['10', null, '20']],
    ['a zero among them', ['10', '0', '20']],
    ['every cell blank', [null, null, null]],
    ['negative and decimal figures', ['-3.5', '10.25', '0']],
  ];

  for (const aggregate of AGGREGATES) {
    for (const policy of POLICIES) {
      for (const [label, values] of CASES) {
        it(`${aggregate} / ${policy} / ${label}`, () => {
          const sheets = names(values.length);
          const formula = buildTotalsFormula({ aggregate, blankPolicy: policy, sheetNames: sheets, address: ADDRESS });
          const wanted = expected(aggregate, policy, values);
          if (formula === null) {
            // The only plain-number case: COUNT with ZERO is just the number of teams.
            expect([aggregate, policy]).toEqual(['COUNT', 'ZERO']);
            expect(wanted).toBe(String(values.length));
            return;
          }
          expect(same(work(formula, sheets, values), wanted)).toBe(true);
        });
      }
    }
  }

  it('no counted team: no formula (the cell stays blank, as the system says "—")', () => {
    expect(buildTotalsFormula({ aggregate: 'SUM', blankPolicy: 'ZERO', sheetNames: [], address: ADDRESS })).toBeNull();
  });

  it('reads the sheets of the counted teams only, by name, quoted (an apostrophe in a name is doubled)', () => {
    const formula = buildTotalsFormula({ aggregate: 'SUM', blankPolicy: 'ZERO', sheetNames: ["Tổ 5'A", 'Đội 2 (TT)'], address: ADDRESS });
    expect(formula).toBe("SUM('Tổ 5''A'!C4,'Đội 2 (TT)'!C4)");
    expect(quoteSheetName("a'b")).toBe("'a''b'");
  });

  it('uses the readable functions when it can: SUM, AVERAGE, MIN, MAX, COUNT', () => {
    const sheets = names(3);
    const f = (aggregate: TotalsAggregate, blankPolicy: TotalsBlankPolicy) => buildTotalsFormula({ aggregate, blankPolicy, sheetNames: sheets, address: ADDRESS }) as string;
    expect(f('AVG', 'IGNORE')).toContain('AVERAGE(');
    expect(f('MIN', 'IGNORE')).toContain('MIN(');
    expect(f('MAX', 'ZERO')).toContain('MAX(');
    expect(f('COUNT', 'IGNORE')).toContain('COUNT(');
    expect(f('AVG', 'ZERO')).toMatch(/^SUM\(.*\)\/3$/);
  });

  describe('many teams (Excel takes 255 arguments and 8,192 characters)', () => {
    const MANY = FORMULA_GROUP_SIZE * 2 + 37;
    const values = Array.from({ length: MANY }, (_, i) => (i % 7 === 3 ? null : String((i * 13) % 50)));

    for (const aggregate of AGGREGATES) {
      for (const policy of POLICIES) {
        it(`${aggregate} / ${policy} with ${MANY} teams still equals the engine, in groups`, () => {
          const sheets = names(MANY);
          const formula = buildTotalsFormula({ aggregate, blankPolicy: policy, sheetNames: sheets, address: ADDRESS });
          if (formula === null) return; // COUNT / ZERO
          expect(same(work(formula, sheets, values), expected(aggregate, policy, values))).toBe(true);
          // No call takes more arguments than Excel allows.
          for (const call of formula.match(/\(([^()]*)\)/g) ?? []) {
            expect(call.split(',').length).toBeLessThanOrEqual(255);
          }
        });
      }
    }

    it('a list too long for one formula gives no formula at all (the cell keeps the number)', () => {
      const sheets = Array.from({ length: 2000 }, (_, i) => `Một tên sheet khá dài số ${i + 1}`);
      expect(buildTotalsFormula({ aggregate: 'SUM', blankPolicy: 'ZERO', sheetNames: sheets, address: ADDRESS })).toBeNull();
    });
  });

  it('PROPERTY: for any teams and numbers the formula and the engine agree', () => {
    const cell = fc.option(
      fc.integer({ min: -100000, max: 100000 }).map((n) => (n / 100).toFixed(2).replace(/\.?0+$/, '') || '0'),
      { nil: null },
    );
    fc.assert(
      fc.property(
        fc.constantFrom(...AGGREGATES),
        fc.constantFrom(...POLICIES),
        fc.array(cell, { minLength: 1, maxLength: 30 }),
        (aggregate, policy, values) => {
          const sheets = names(values.length);
          const formula = buildTotalsFormula({ aggregate, blankPolicy: policy, sheetNames: sheets, address: ADDRESS });
          if (formula === null) return aggregate === 'COUNT' && policy === 'ZERO';
          return same(work(formula, sheets, values), expected(aggregate, policy, values));
        },
      ),
      { numRuns: 400 },
    );
  });
});
