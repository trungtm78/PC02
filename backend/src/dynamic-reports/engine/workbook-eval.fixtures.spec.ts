import * as fs from 'fs';
import * as path from 'path';
import { evaluateWorkbook } from './workbook-eval';
import type { CellOutcome, WorkbookCell, WorkbookModel } from './workbook-eval';
import { parseFormula } from './expr';

/**
 * Real-template oracle for the workbook evaluator.
 *
 * Each JSON under test/fixtures/dynamic-reports/real/formula-oracle-*.json
 * is produced by generate-formula-oracle.py: every constant of a real
 * template, every formula, and the value EXCEL cached for that formula when
 * the file was last saved. Excel is the calculator being imitated, so its
 * own result is the reference — nothing here comes from the engine.
 *
 * The contract has two halves:
 *  1. Every formula the engine accepts must reproduce Excel's cached value.
 *  2. Every formula it does not accept must be one that uses a construct
 *     outside the allowed grammar (D05) — rejected loudly at parse time,
 *     never evaluated to a wrong number.
 */

const REAL_DIR = path.join(__dirname, '../../../test/fixtures/dynamic-reports/real');

type Scalar = number | string | { bool: boolean } | { date: string } | null;
interface OracleSheet {
  name: string;
  constants: Record<string, Scalar>;
  formulas: Record<string, { f: string; cached: Scalar }>;
}
interface FilledOracle {
  filled: Record<string, number>;
  expected: Record<string, number | { bool: boolean } | { frac: [number, number] }>;
}
interface Oracle {
  source: string;
  sheets: OracleSheet[];
  filledOracle: FilledOracle;
}

function load(stem: string): Oracle {
  return JSON.parse(
    fs.readFileSync(path.join(REAL_DIR, `formula-oracle-${stem}.json`), 'utf-8'),
  ) as Oracle;
}

function toModel(oracle: Oracle): WorkbookModel {
  return {
    sheets: oracle.sheets.map((s) => {
      const cells: Record<string, WorkbookCell> = {};
      for (const [addr, v] of Object.entries(s.constants)) {
        if (typeof v === 'number') cells[addr] = { kind: 'number', value: String(v) };
        else if (typeof v === 'string') cells[addr] = { kind: 'text', value: v };
      }
      for (const [addr, def] of Object.entries(s.formulas)) {
        cells[addr] = { kind: 'formula', source: def.f };
      }
      return { name: s.name, cells };
    }),
  };
}

const ERROR_LITERALS: Record<string, string[]> = {
  '#DIV/0!': ['DIV_BY_ZERO'],
  '#VALUE!': ['TYPE_ERROR'],
  '#REF!': ['NOT_FOUND_REFERENCE', 'OUT_OF_SCOPE_REFERENCE', 'CYCLE_DETECTED'],
  '#NAME?': ['TYPE_ERROR'],
  '#N/A': ['TYPE_ERROR', 'NOT_FOUND_REFERENCE'],
};

function sameNumber(engine: string, excel: number): boolean {
  const e = Number(engine);
  if (e === excel) return true;
  // Excel stores IEEE doubles; the engine is exact decimal. Agree to 12 significant digits.
  const scale = Math.max(1, Math.abs(excel));
  return Math.abs(e - excel) <= scale * 1e-12;
}

interface Report {
  compared: number;
  mismatches: string[];
  rejected: Array<{ where: string; formula: string; reason: string }>;
  unexpectedErrors: string[];
}

function run(oracle: Oracle): Report {
  const model = toModel(oracle);
  const results = evaluateWorkbook(model, {}, { blankAs: 'blank' });
  const report: Report = { compared: 0, mismatches: [], rejected: [], unexpectedErrors: [] };

  for (const sheet of oracle.sheets) {
    for (const [addr, def] of Object.entries(sheet.formulas)) {
      const where = `${sheet.name}!${addr}`;
      const outcome = results.get(where) as CellOutcome;
      const cached = def.cached;
      if (cached === null) continue;

      const parsed = parseFormula(def.f);
      if (!parsed.ok) {
        report.rejected.push({ where, formula: def.f, reason: parsed.error.code });
        continue;
      }

      if (!outcome.ok) {
        const allowed = typeof cached === 'string' ? ERROR_LITERALS[cached] : undefined;
        if (allowed?.includes(outcome.error.code)) {
          report.compared++;
        } else {
          report.unexpectedErrors.push(
            `${where} =${def.f} → engine ${outcome.error.code}, Excel ${JSON.stringify(cached)}`,
          );
        }
        continue;
      }

      report.compared++;
      const v = outcome.value;
      let ok = false;
      if (typeof cached === 'number' && v.type === 'number') ok = sameNumber(v.value, cached);
      else if (typeof cached === 'string' && v.type === 'string') ok = v.value === cached;
      else if (typeof cached === 'object' && cached !== null && 'bool' in cached && v.type === 'boolean') {
        ok = v.value === cached.bool;
      } else if (typeof cached === 'number' && v.type === 'boolean') {
        ok = (v.value ? 1 : 0) === cached; // Excel caches booleans as 1/0 in some writers
      } else if (typeof cached === 'number' && v.type === 'string') {
        ok = false;
      }
      if (!ok) {
        report.mismatches.push(
          `${where} =${def.f} → engine ${JSON.stringify(v)}, Excel ${JSON.stringify(cached)}`,
        );
      }
    }
  }
  return report;
}

/**
 * HSLN: 16 unit sheets feeding a TỔNG sheet of 228 three-dimensional sums.
 * `hsln-oracle.json` holds each row's sum computed by plain Python arithmetic
 * (not by the engine and not from the workbook's cache, 190 of whose TỔNG
 * values are a stale `#REF!`).
 */
describe('HSLN 3-D totals against the independent oracle', () => {
  interface HslnRow {
    address: string;
    formula: string;
    supported3DSum: boolean;
    perSheetValues: Record<string, number | null>;
    sumIgnoringBlanks: number | null;
  }
  const hsln = JSON.parse(
    fs.readFileSync(path.join(REAL_DIR, 'hsln-oracle.json'), 'utf-8'),
  ) as { tongSheet: string; unitSheets: string[]; rows: HslnRow[] };

  const rows = hsln.rows.filter((r) => r.supported3DSum);
  const unit: Record<string, Record<string, WorkbookCell>> = {};
  const inputs: Record<string, string> = {};
  for (const name of hsln.unitSheets) unit[name] = {};
  const tong: Record<string, WorkbookCell> = {};
  for (const r of rows) {
    tong[r.address] = { kind: 'formula', source: r.formula.slice(1) };
    for (const [sheet, v] of Object.entries(r.perSheetValues)) {
      unit[sheet][r.address] = { kind: 'input', type: 'NUM' };
      if (typeof v === 'number') inputs[`${sheet}!${r.address}`] = String(v);
    }
  }
  // TỔNG sits BEFORE the unit sheets in tab order, exactly like the workbook,
  // so 'Đội 3:Cơ sở 2' must span only the sixteen unit sheets.
  const model: WorkbookModel = {
    sheets: [
      { name: hsln.tongSheet, cells: tong },
      ...hsln.unitSheets.map((name) => ({ name, cells: unit[name] })),
    ],
  };
  const results = evaluateWorkbook(model, inputs, { blankAs: 'blank' });

  it('covers the whole report', () => {
    expect(rows.length).toBeGreaterThanOrEqual(200);
    expect(hsln.unitSheets).toHaveLength(16);
  });

  it('every TỔNG row equals the independently computed sum', () => {
    const wrong: string[] = [];
    for (const r of rows) {
      const got = results.get(`${hsln.tongSheet}!${r.address}`) as CellOutcome;
      // A row with no numeric value anywhere has a null oracle sum; SUM of nothing is 0.
      const want = r.sumIgnoringBlanks ?? 0;
      if (!got.ok || got.value.type !== 'number' || Number(got.value.value) !== want) {
        wrong.push(`${r.address}: engine ${JSON.stringify(got)}, expected ${want}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("'none' mode refuses to total a row with a missing unit value instead of treating it as 0", () => {
    const withGap = { ...inputs };
    delete withGap[`${hsln.unitSheets[3]}!${rows[0].address}`];
    const res = evaluateWorkbook(model, withGap, { blankAs: 'none' });
    expect(res.get(`${hsln.tongSheet}!${rows[0].address}`)).toMatchObject({
      ok: false,
      error: { code: 'MISSING_DATA' },
    });
  });
});

const TEMPLATES = [
  'bao_cao_ngay_shared_formulas',
  'a09_1034_unlocked',
  'a10_99_formulas',
  'pl7',
  'phu_luc_07_08_multi_sheet',
];

describe.each(TEMPLATES)('Excel cached values — %s', (stem) => {
  const oracle = load(stem);
  const report = run(oracle);

  it('reproduces every cached value the engine agrees to evaluate', () => {
    expect(report.mismatches).toEqual([]);
  });

  it('never turns a cell Excel computed into an unexplained error', () => {
    expect(report.unexpectedErrors).toEqual([]);
  });

  it('compares a meaningful number of formulas', () => {
    const total = Object.values(oracle.sheets).reduce(
      (n, s) => n + Object.keys(s.formulas).length,
      0,
    );
    // Whatever is rejected at parse time is listed, so growth of the
    // unsupported set shows up in review instead of hiding in a percentage.
    // eslint-disable-next-line no-console
    if (report.rejected.length > 0) console.log(`${stem}: rejected`, report.rejected.slice(0, 8));
    expect(report.compared + report.rejected.length).toBe(total);
    expect(report.compared).toBeGreaterThan(0);
  });
});

/**
 * Second reference: the templates ship empty, so Excel's cache is mostly 0.
 * Here every input cell gets a deterministic non-zero value and the expected
 * results come from generate-formula-oracle.py's own evaluator — plain Python
 * over exact fractions, a different language and parser from the engine.
 */
describe.each(TEMPLATES)('independent Python evaluator over filled inputs — %s', (stem) => {
  const oracle = load(stem);
  const { filled, expected } = oracle.filledOracle;

  const model = toModel(oracle);
  // Cells the generator invented are input cells in the engine's model.
  for (const key of Object.keys(filled)) {
    const bang = key.lastIndexOf('!');
    const sheet = model.sheets.find((s) => s.name === key.slice(0, bang));
    if (sheet) sheet.cells[key.slice(bang + 1)] = { kind: 'input', type: 'NUM' };
  }
  const inputs: Record<string, string> = {};
  for (const [key, n] of Object.entries(filled)) inputs[key] = String(n);
  const results = evaluateWorkbook(model, inputs, { blankAs: 'blank' });

  it('gives the engine a non-trivial amount to get wrong', () => {
    expect(Object.keys(filled).length).toBeGreaterThan(20);
    expect(Object.keys(expected).length).toBeGreaterThan(0);
  });

  it('agrees with the independent evaluator on every formula it computed', () => {
    const wrong: string[] = [];
    for (const [key, want] of Object.entries(expected)) {
      const got = results.get(key) as CellOutcome;
      if (!got.ok) {
        wrong.push(`${key}: engine error ${got.error.code}, expected ${JSON.stringify(want)}`);
        continue;
      }
      const v = got.value;
      if (typeof want === 'number') {
        if (v.type !== 'number' || v.value !== String(want)) {
          wrong.push(`${key}: engine ${JSON.stringify(v)}, expected ${want}`);
        }
      } else if ('bool' in want) {
        if (v.type !== 'boolean' || v.value !== want.bool) {
          wrong.push(`${key}: engine ${JSON.stringify(v)}, expected ${want.bool}`);
        }
      } else {
        const [num, den] = want.frac;
        if (v.type !== 'number' || Math.abs(Number(v.value) - num / den) > 1e-12) {
          wrong.push(`${key}: engine ${JSON.stringify(v)}, expected ${num}/${den}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
