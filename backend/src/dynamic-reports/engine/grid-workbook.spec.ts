import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { CALC_ENGINE_VERSION, evaluateAllFormulas, evaluateGridWorkbook, toWorkbookModel } from './grid-workbook';
import type { InputFieldRef } from './grid-workbook';
import type { GridModel, GridSheet } from './grid-types';
import { extractGridModel } from '../template/grid-extract';
import { readRawGridInfo } from '../template/grid-raw';

/**
 * The bridge GridModel → WorkbookModel is where an input overrides the sample
 * number a template ships and where a static TRUE stays a boolean. Two layers
 * of proof: hand-worked cases for those rules, and the real templates run
 * through the WHOLE chain (xlsx → extractor → bridge → evaluator) against the
 * values Excel itself cached.
 */

function sheet(name: string, cells: GridSheet['cells']): GridSheet {
  return {
    name,
    rows: 10,
    cols: 10,
    colWidthsPx: [],
    rowHeightsPx: [],
    hiddenRows: [],
    hiddenCols: [],
    merges: [],
    freeze: { rows: 0, cols: 0 },
    showGridlines: true,
    showZeros: true,
    zoom: 100,
    cells,
    colStyles: [],
    rowStyles: {},
    conditionalFormats: [],
    validations: [],
  };
}

function grid(sheets: GridSheet[], excluded: string[] = []): GridModel {
  return {
    engineVersion: 1,
    dateSystem: 1900,
    sheetOrder: sheets.map((s) => s.name),
    excludedSheets: excluded,
    styles: [{}],
    defaultFont: { name: 'Calibri', sizePt: 11 },
    sheets,
    warnings: [],
  };
}

const field = (address: string, type: InputFieldRef['type'] = 'NUM', sheetKey = 'S'): InputFieldRef => ({
  sheetKey,
  address,
  fieldKey: `${sheetKey}!${address}`,
  type,
});

function numberAt(ev: ReturnType<typeof evaluateGridWorkbook>['evaluator'], sheetName: string, address: string): string {
  const r = ev.get(sheetName, address);
  if (!r || !r.ok || r.value.type !== 'number') throw new Error(`${sheetName}!${address}: ${JSON.stringify(r)}`);
  return r.value.value;
}

describe('toWorkbookModel', () => {
  it('maps every cell kind, and drops empty cells', () => {
    const g = grid([
      sheet('S', {
        A1: { k: 'num', v: '7', s: 0 },
        A2: { k: 'text', v: 'nhãn', s: 0 },
        A3: { k: 'bool', v: true, s: 0 },
        A4: { k: 'formula', f: 'A1*2', s: 0 },
        A5: { k: 'empty', s: 0 },
      }),
    ]);
    expect(toWorkbookModel(g, []).sheets[0].cells).toEqual({
      A1: { kind: 'number', value: '7' },
      A2: { kind: 'text', value: 'nhãn' },
      A3: { kind: 'boolean', value: true },
      A4: { kind: 'formula', source: 'A1*2' },
    });
  });

  it('an input replaces whatever the file holds in that cell, on its own sheet only', () => {
    const g = grid([
      sheet('S', { A1: { k: 'num', v: '99', s: 0 } }),
      sheet('T', { A1: { k: 'num', v: '5', s: 0 } }),
    ]);
    const m = toWorkbookModel(g, [field('A1')]);
    expect(m.sheets[0].cells.A1).toEqual({ kind: 'input', type: 'NUM' });
    expect(m.sheets[1].cells.A1).toEqual({ kind: 'number', value: '5' });
  });

  it('carries the excluded sheets through', () => {
    const g = grid([sheet('S', {}), sheet('TỔNG', {})], ['TỔNG']);
    expect(toWorkbookModel(g, []).excludedSheets).toEqual(['TỔNG']);
  });
});

describe('evaluateGridWorkbook', () => {
  const g = grid([
    sheet('S', {
      A1: { k: 'num', v: '99', s: 0 }, // a sample number the template ships in an unlocked cell
      A2: { k: 'empty', s: 0 },
      A3: { k: 'formula', f: 'SUM(A1:A2)', s: 0 },
      A4: { k: 'bool', v: true, s: 0 },
      A5: { k: 'formula', f: 'SUM(A1:A2,A4:A4)', s: 0 },
      A6: { k: 'formula', f: 'A4+1', s: 0 },
    }),
  ]);
  const fields = [field('A1'), field('A2')];

  it('works out formulas from the submitted values, not from the sample the file holds', () => {
    const { evaluator } = evaluateGridWorkbook(g, fields, { 'S!A1': '10', 'S!A2': '2.5' });
    expect(numberAt(evaluator, 'S', 'A3')).toBe('12.5');
  });

  it('a blank input is blank while entering (Excel), and an absent value is the same as null or ""', () => {
    for (const v of [undefined, null, ''] as const) {
      const { evaluator } = evaluateGridWorkbook(g, fields, { 'S!A1': '4', 'S!A2': v });
      expect(numberAt(evaluator, 'S', 'A3')).toBe('4');
    }
  });

  it('a static TRUE is ignored by SUM over a range', () => {
    const { evaluator } = evaluateGridWorkbook(g, fields, { 'S!A1': '10', 'S!A2': '1' });
    expect(numberAt(evaluator, 'S', 'A5')).toBe('11'); // 10 + 1; the TRUE in the range counts for nothing
    // Used directly in arithmetic the engine refuses rather than guess (Excel would say 2): a refusal can
    // be seen and fixed, a quiet coercion cannot.
    const direct = evaluator.get('S', 'A6');
    expect(direct && !direct.ok && direct.error.code).toBe('TYPE_ERROR');
  });

  it('18 significant digits survive end to end', () => {
    const wide = grid([
      sheet('S', { A1: { k: 'empty', s: 0 }, A2: { k: 'formula', f: 'A1+1', s: 0 } }),
    ]);
    const { evaluator } = evaluateGridWorkbook(wide, [field('A1')], { 'S!A1': '9007199254740993' });
    expect(numberAt(evaluator, 'S', 'A2')).toBe('9007199254740994');
  });

  it('formulas read across sheets', () => {
    const two = grid([
      sheet('S', { A1: { k: 'empty', s: 0 } }),
      sheet('TỔNG', { A1: { k: 'formula', f: "'S'!A1*2", s: 0 } }),
    ]);
    const { evaluator } = evaluateGridWorkbook(two, [field('A1')], { 'S!A1': '21' });
    expect(numberAt(evaluator, 'TỔNG', 'A1')).toBe('42');
  });
});

describe('evaluateAllFormulas (official figures, review OV1/OV10)', () => {
  const g = grid([
    sheet('S', {
      A1: { k: 'empty', s: 0 },
      A2: { k: 'empty', s: 0 },
      A3: { k: 'formula', f: 'A1+A2', s: 0 },
      A4: { k: 'formula', f: 'A1/A2', s: 0 },
      A5: { k: 'formula', f: 'IF(A3=10,"Đúng","Sai")', s: 0 },
      A6: { k: 'formula', f: 'A3=10', s: 0 },
      A7: { k: 'num', v: '1', s: 0 },
    }),
  ]);
  const fields = [field('A1'), field('A2')];

  it('reports every formula cell, keyed Sheet!Address, and nothing else', () => {
    const out = evaluateAllFormulas(g, fields, { 'S!A1': '4', 'S!A2': '6' });
    expect(Object.keys(out).sort()).toEqual(['S!A3', 'S!A4', 'S!A5', 'S!A6']);
    expect(out['S!A3']).toEqual({ ok: true, type: 'number', value: '10' });
    expect(out['S!A5']).toEqual({ ok: true, type: 'string', value: 'Đúng' });
    expect(out['S!A6']).toEqual({ ok: true, type: 'boolean', value: true });
  });

  it('keeps every digit of a number: values cross the thread as decimal text', () => {
    const out = evaluateAllFormulas(g, fields, { 'S!A1': '900719925474099300', 'S!A2': '1.5' });
    expect(out['S!A3']).toEqual({ ok: true, type: 'number', value: '900719925474099301.5' });
  });

  it('a failing formula carries the code of the engine, and does not stop the others', () => {
    const out = evaluateAllFormulas(g, fields, { 'S!A1': '4', 'S!A2': '0' });
    expect(out['S!A4']).toEqual({ ok: false, code: 'DIV_BY_ZERO' });
    expect(out['S!A3']).toEqual({ ok: true, type: 'number', value: '4' });
  });

  it('a missing contribution is reported when aggregating, not silently counted as 0', () => {
    const none = evaluateAllFormulas(g, fields, { 'S!A1': '4', 'S!A2': null }, 'none');
    expect(none['S!A3'].ok).toBe(false);
    const blank = evaluateAllFormulas(g, fields, { 'S!A1': '4', 'S!A2': null }, 'blank');
    expect(blank['S!A3']).toEqual({ ok: true, type: 'number', value: '4' });
  });

  it('names the calculator that produced the figures', () => {
    expect(CALC_ENGINE_VERSION).toBe(1);
  });
});

// ---- the whole chain against Excel's own cached results -------------------------------------

const REAL = path.join(__dirname, '../../../test/fixtures/dynamic-reports/real');

type Scalar = number | string | { bool: boolean } | { date: string } | null;
interface FormulaOracle {
  sheets: Array<{ name: string; formulas: Record<string, { f: string; cached: Scalar }> }>;
}

const TEMPLATES = [
  'pl7',
  'a09_1034_unlocked',
  'a10_99_formulas',
  'bao_cao_ngay_shared_formulas',
  'phu_luc_07_08_multi_sheet',
];

describe.each(TEMPLATES)('xlsx → GridModel → bridge → evaluator vs Excel cache — %s', (stem) => {
  it('reproduces the value Excel cached for every formula it accepts (numbers and TRUE/FALSE)', async () => {
    const buffer = fs.readFileSync(path.join(REAL, `${stem}.xlsx`));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const raw = await readRawGridInfo(buffer);
    const names = workbook.worksheets.map((w) => w.name);
    const model = extractGridModel(workbook, { selectedSheets: names, excludedSheets: [], raw });
    const oracle = JSON.parse(
      fs.readFileSync(path.join(REAL, `formula-oracle-${stem}.json`), 'utf-8'),
    ) as FormulaOracle;

    const { evaluator } = evaluateGridWorkbook(model, [], {});

    let compared = 0;
    const wrong: string[] = [];
    for (const s of oracle.sheets) {
      for (const [address, def] of Object.entries(s.formulas)) {
        const got = evaluator.get(s.name, address);
        if (!got || !got.ok) continue; // outside the grammar: covered by the evaluator's own fixture spec
        if (typeof def.cached === 'number' && got.value.type === 'number') {
          compared += 1;
          const scale = Math.max(1, Math.abs(def.cached));
          if (Math.abs(Number(got.value.value) - def.cached) > scale * 1e-12) {
            wrong.push(`${s.name}!${address}: ${got.value.value} vs Excel ${def.cached}`);
          }
        } else if (def.cached !== null && typeof def.cached === 'object' && 'bool' in def.cached) {
          compared += 1;
          if (got.value.type !== 'boolean' || got.value.value !== def.cached.bool) {
            wrong.push(`${s.name}!${address}: ${JSON.stringify(got.value)} vs Excel ${def.cached.bool}`);
          }
        }
      }
    }
    expect(wrong).toEqual([]);
    // A silent pass must be impossible: the chain really did compare something.
    expect(compared).toBeGreaterThan(0);
  });
});
