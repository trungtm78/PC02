import {
  WorkbookEvaluator,
  evaluateWorkbook,
  expandRangeRefs,
} from './workbook-eval';
import type { WorkbookModel, WorkbookCell } from './workbook-eval';
import { RangeLimitError } from './expr';

/**
 * G0 — workbook-wide evaluation: dependency graph over every sheet, 2-D and
 * 3-D ranges, incremental recompute, cycle detection, Excel-style error
 * propagation, and the two blank modes (entry vs aggregate, plan §1).
 *
 * Every expected number below is worked out by hand from Excel's rules.
 */

const n = (): WorkbookCell => ({ kind: 'input', type: 'NUM' });
const f = (source: string): WorkbookCell => ({ kind: 'formula', source });
const k = (value: string): WorkbookCell => ({ kind: 'number', value });
const t = (value: string): WorkbookCell => ({ kind: 'text', value });

function single(cells: Record<string, WorkbookCell>): WorkbookModel {
  return { sheets: [{ name: 'S', cells }] };
}

function numberOf(
  results: Map<string, ReturnType<WorkbookEvaluator['get']>>,
  key: string,
): string {
  const r = results.get(key);
  if (!r || !r.ok || r.value.type !== 'number') {
    throw new Error(`${key}: expected a number, got ${JSON.stringify(r)}`);
  }
  return r.value.value;
}

describe('evaluateWorkbook — basics', () => {
  it('sums inputs and chains a dependent formula', () => {
    const model = single({
      A1: n(),
      A2: n(),
      A3: f('SUM(A1:A2)'),
      A4: f('A3*2'),
    });
    const res = evaluateWorkbook(model, { 'S!A1': '1.5', 'S!A2': '2.5' }, { blankAs: 'blank' });
    expect(numberOf(res, 'S!A3')).toBe('4');
    expect(numberOf(res, 'S!A4')).toBe('8');
  });

  it('a static constant participates in a formula', () => {
    const model = single({ A1: k('10'), A2: n(), A3: f('A1+A2') });
    const res = evaluateWorkbook(model, { 'S!A2': '5' }, { blankAs: 'blank' });
    expect(numberOf(res, 'S!A3')).toBe('15');
  });

  it('a static TRUE/FALSE stays a boolean: ranges ignore it, direct use counts it (Excel)', () => {
    const model = single({
      A1: { kind: 'boolean', value: true },
      A2: k('5'),
      A3: f('SUM(A1:A2)'),
      A4: f('COUNT(A1:A2)'),
      A5: f('IF(A1,1,0)'),
    });
    const res = evaluateWorkbook(model, {}, { blankAs: 'blank' });
    expect(numberOf(res, 'S!A3')).toBe('5');
    expect(numberOf(res, 'S!A4')).toBe('1');
    expect(numberOf(res, 'S!A5')).toBe('1');
  });

  it('keeps 18 significant digits end to end (OV4)', () => {
    const model = single({ A1: n(), A2: f('A1+1') });
    const res = evaluateWorkbook(model, { 'S!A1': '9007199254740993' }, { blankAs: 'blank' });
    expect(numberOf(res, 'S!A2')).toBe('9007199254740994');
  });

  it('a text formula result and a boolean one are returned as such', () => {
    const model = single({
      A1: n(),
      A2: n(),
      B1: f('IF(A1=A2,"Đúng","Sai")'),
      B2: f('A1>A2'),
      B3: f('IF(B2,1,0)'),
    });
    const res = evaluateWorkbook(model, { 'S!A1': '7', 'S!A2': '3' }, { blankAs: 'blank' });
    expect(res.get('S!B1')).toEqual({ ok: true, value: { type: 'string', value: 'Sai' } });
    expect(res.get('S!B2')).toEqual({ ok: true, value: { type: 'boolean', value: true } });
    expect(numberOf(res, 'S!B3')).toBe('1');
  });

  it('a text cell is ignored by SUM but joined by &', () => {
    const model = single({
      A1: t('Tổ '),
      A2: n(),
      A3: f('SUM(A1:A2)'),
      A4: f('A1&A2'),
    });
    const res = evaluateWorkbook(model, { 'S!A2': '3' }, { blankAs: 'blank' });
    expect(numberOf(res, 'S!A3')).toBe('3');
    expect(res.get('S!A4')).toEqual({ ok: true, value: { type: 'string', value: 'Tổ 3' } });
  });
});

describe('blank modes', () => {
  const model = single({
    A1: n(),
    A2: n(),
    A3: f('SUM(A1:A2)'),
    A4: f('A1+1'),
  });

  it("'blank' (entry): an empty input is an empty cell — 0 in arithmetic, skipped by SUM", () => {
    const res = evaluateWorkbook(model, { 'S!A2': '2.5' }, { blankAs: 'blank' });
    expect(numberOf(res, 'S!A3')).toBe('2.5');
    expect(numberOf(res, 'S!A4')).toBe('1');
  });

  it("'none' (aggregate): missing data propagates instead of silently becoming 0", () => {
    const res = evaluateWorkbook(model, { 'S!A2': '2.5' }, { blankAs: 'none' });
    for (const key of ['S!A3', 'S!A4']) {
      const r = res.get(key);
      expect(r).toMatchObject({ ok: false, error: { code: 'MISSING_DATA' } });
    }
  });

  it("'none' still computes when every input is present", () => {
    const res = evaluateWorkbook(model, { 'S!A1': '1', 'S!A2': '2.5' }, { blankAs: 'none' });
    expect(numberOf(res, 'S!A3')).toBe('3.5');
  });

  it('an unparseable NUM input makes its dependents #VALUE! (TYPE_ERROR), not a crash', () => {
    const res = evaluateWorkbook(model, { 'S!A1': 'abc', 'S!A2': '1' }, { blankAs: 'blank' });
    expect(res.get('S!A3')).toMatchObject({ ok: false, error: { code: 'TYPE_ERROR' } });
  });
});

describe('errors and cycles', () => {
  it('propagates an upstream error to every dependent', () => {
    const model = single({ A1: f('1/0'), A2: f('A1+1'), A3: f('SUM(A1:A2)') });
    const res = evaluateWorkbook(model, {}, { blankAs: 'blank' });
    for (const key of ['S!A1', 'S!A2', 'S!A3']) {
      expect(res.get(key)).toMatchObject({ ok: false, error: { code: 'DIV_BY_ZERO' } });
    }
  });

  it('IF does not evaluate its untaken branch, so that branch error stays local', () => {
    const model = single({ A1: f('1/0'), A2: f('IF(1=1,5,A1)') });
    const res = evaluateWorkbook(model, {}, { blankAs: 'blank' });
    expect(numberOf(res, 'S!A2')).toBe('5');
  });

  it('flags a two-cell cycle and every cell that depends on it', () => {
    const model = single({ A1: f('A2'), A2: f('A1'), A3: f('A1+1'), A4: k('1') });
    const res = evaluateWorkbook(model, {}, { blankAs: 'blank' });
    for (const key of ['S!A1', 'S!A2', 'S!A3']) {
      expect(res.get(key)).toMatchObject({ ok: false, error: { code: 'CYCLE_DETECTED' } });
    }
  });

  it('flags a self reference', () => {
    const res = evaluateWorkbook(single({ A1: f('A1+1') }), {}, { blankAs: 'blank' });
    expect(res.get('S!A1')).toMatchObject({ ok: false, error: { code: 'CYCLE_DETECTED' } });
  });

  it('a syntax error fails only that cell', () => {
    const model = single({ A1: f('SUM('), A2: f('1+1') });
    const res = evaluateWorkbook(model, {}, { blankAs: 'blank' });
    expect(res.get('S!A1')).toMatchObject({ ok: false, error: { code: 'TYPE_ERROR' } });
    expect(numberOf(res, 'S!A2')).toBe('2');
  });

  it('survives a 3 000-long dependency chain without overflowing the stack', () => {
    const cells: Record<string, WorkbookCell> = { A1: n() };
    for (let i = 2; i <= 3000; i++) cells[`A${i}`] = f(`A${i - 1}+1`);
    const res = evaluateWorkbook(single(cells), { 'S!A1': '1' }, { blankAs: 'blank' });
    expect(numberOf(res, 'S!A3000')).toBe('3000');
  });
});

describe('references across sheets', () => {
  const model: WorkbookModel = {
    sheets: [
      { name: 'Đội 3', cells: { C6: n(), A1: n(), B2: n() } },
      { name: 'Đội 4', cells: { C6: n() } },
      { name: 'Ghi chú', cells: { C6: k('100') } },
      { name: 'Cơ sở 2', cells: { C6: n() } },
      {
        name: 'TỔNG',
        cells: {
          C6: f("SUM('Đội 3:Cơ sở 2'!C6)"),
          C7: f("SUM('Đội 3'!A1:B2)"),
          C8: f("'Đội 4'!C6+1"),
        },
      },
    ],
  };
  const inputs = {
    'Đội 3!C6': '1',
    'Đội 4!C6': '2',
    'Cơ sở 2!C6': '4',
    'Đội 3!A1': '10',
    'Đội 3!B2': '20',
  };

  it('3-D reference covers every sheet between the two ends in tab order, static ones included', () => {
    const res = evaluateWorkbook(model, inputs, { blankAs: 'blank' });
    // 1 + 2 + 100 (Ghi chú sits between) + 4
    expect(numberOf(res, 'TỔNG!C6')).toBe('107');
  });

  it('2-D range on another sheet; absent cells inside it are empty', () => {
    const res = evaluateWorkbook(model, inputs, { blankAs: 'blank' });
    expect(numberOf(res, 'TỔNG!C7')).toBe('30');
  });

  it('a quoted single-sheet reference', () => {
    const res = evaluateWorkbook(model, inputs, { blankAs: 'blank' });
    expect(numberOf(res, 'TỔNG!C8')).toBe('3');
  });

  it('an unknown sheet is #REF! (NOT_FOUND_REFERENCE)', () => {
    const m = single({ A1: f("'Không có'!A1") });
    const res = evaluateWorkbook(m, {}, { blankAs: 'blank' });
    expect(res.get('S!A1')).toMatchObject({ ok: false, error: { code: 'NOT_FOUND_REFERENCE' } });
  });

  it('a sheet the report excluded is out of scope, distinct from a missing one (OV1)', () => {
    const m: WorkbookModel = {
      sheets: [{ name: 'S', cells: { A1: f("'Tổ 10'!C6") } }],
      excludedSheets: ['Tổ 10'],
    };
    const res = evaluateWorkbook(m, {}, { blankAs: 'blank' });
    expect(res.get('S!A1')).toMatchObject({
      ok: false,
      error: { code: 'OUT_OF_SCOPE_REFERENCE' },
    });
  });

  it('a 3-D range whose end sheet is missing is #REF!', () => {
    const m: WorkbookModel = {
      sheets: [
        { name: 'T1', cells: { C6: k('1') } },
        { name: 'S', cells: { A1: f("SUM('T1:Nope'!C6)") } },
      ],
    };
    const res = evaluateWorkbook(m, {}, { blankAs: 'blank' });
    expect(res.get('S!A1')).toMatchObject({ ok: false, error: { code: 'NOT_FOUND_REFERENCE' } });
  });

  it('a formula on one sheet may feed a formula on another', () => {
    const m: WorkbookModel = {
      sheets: [
        { name: 'T1', cells: { A1: n(), A2: f('A1*10') } },
        { name: 'TỔNG', cells: { A1: f('T1!A2+1') } },
      ],
    };
    const res = evaluateWorkbook(m, { 'T1!A1': '3' }, { blankAs: 'blank' });
    expect(numberOf(res, 'TỔNG!A1')).toBe('31');
  });
});

describe('range allocation guard (OV9)', () => {
  it('refuses a huge range before allocating it', () => {
    const m = single({ A1: f('SUM(A2:XFD1048576)') });
    const started = Date.now();
    const res = evaluateWorkbook(m, {}, { blankAs: 'blank' });
    expect(res.get('S!A1')).toMatchObject({
      ok: false,
      error: { code: 'STEP_LIMIT_EXCEEDED' },
    });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('expandRangeRefs throws RangeLimitError above its cap and lists nothing', () => {
    expect(() =>
      expandRangeRefs({ cellFrom: 'A1', cellTo: 'Z1000' }, 'S', ['S'], 100),
    ).toThrow(RangeLimitError);
  });

  it('expandRangeRefs normalises a reversed rectangle and walks it row-major', () => {
    const refs = expandRangeRefs({ cellFrom: 'B2', cellTo: 'A1' }, 'S', ['S'], 100);
    expect(refs.map((r) => `${r.sheet}!${r.cell}`)).toEqual([
      'S!A1',
      'S!B1',
      'S!A2',
      'S!B2',
    ]);
  });
});

describe('WorkbookEvaluator — incremental recompute', () => {
  const model = single({
    A1: n(),
    A2: n(),
    A3: f('SUM(A1:A2)'),
    A4: f('A3*2'),
    B1: n(),
    B2: f('B1+1'),
  });

  it('recomputes only the cells downstream of the changed input, in dependency order', () => {
    const ev = new WorkbookEvaluator(model, { 'S!A1': '1', 'S!A2': '2', 'S!B1': '5' }, { blankAs: 'blank' });
    const changed = ev.setInput('S', 'A1', '10');
    expect(changed.sort()).toEqual(['S!A3', 'S!A4']);
    expect(ev.get('S', 'A3')).toEqual({ ok: true, value: { type: 'number', value: '12' } });
    expect(ev.get('S', 'A4')).toEqual({ ok: true, value: { type: 'number', value: '24' } });
    expect(ev.get('S', 'B2')).toEqual({ ok: true, value: { type: 'number', value: '6' } });
  });

  it('reports nothing for an input no formula reads, or for an unchanged outcome', () => {
    const ev = new WorkbookEvaluator(model, { 'S!A1': '1', 'S!A2': '2' }, { blankAs: 'blank' });
    expect(ev.setInput('S', 'C9', '5')).toEqual([]);
    expect(ev.setInput('S', 'A1', '1')).toEqual([]);
  });

  it('clearing an input (null) recomputes with the blank rule of the mode', () => {
    const ev = new WorkbookEvaluator(model, { 'S!A1': '1', 'S!A2': '2' }, { blankAs: 'blank' });
    ev.setInput('S', 'A1', null);
    expect(ev.get('S', 'A3')).toEqual({ ok: true, value: { type: 'number', value: '2' } });
  });

  it('matches a full evaluation after any sequence of edits', () => {
    const edits: Array<[string, string | null]> = [
      ['A1', '3'],
      ['B1', '9'],
      ['A2', null],
      ['A1', '0.5'],
      ['A2', '7'],
    ];
    const live = new WorkbookEvaluator(model, {}, { blankAs: 'blank' });
    const inputs: Record<string, string | null> = {};
    for (const [addr, raw] of edits) {
      live.setInput('S', addr, raw);
      inputs[`S!${addr}`] = raw;
      const fresh = evaluateWorkbook(model, inputs, { blankAs: 'blank' });
      for (const [key, outcome] of fresh) {
        const [sheet, addr2] = key.split('!');
        expect(live.get(sheet, addr2)).toEqual(outcome);
      }
    }
  });
});
