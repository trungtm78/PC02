import { WorkbookEvaluator, evaluateWorkbook } from './workbook-eval';
import type { WorkbookCell, WorkbookModel } from './workbook-eval';
import { formatFormula, parseFormula } from './expr';

/**
 * Hostile and awkward input for the workbook evaluator. Nothing here may
 * throw out of the evaluator, hang, or allocate without bound; a bad formula
 * fails its own cell and nobody else's.
 */

const f = (source: string): WorkbookCell => ({ kind: 'formula', source });
const n = (): WorkbookCell => ({ kind: 'input', type: 'NUM' });
const single = (cells: Record<string, WorkbookCell>): WorkbookModel => ({
  sheets: [{ name: 'S', cells }],
});

describe('hostile formulas', () => {
  it('a whole-sheet-sized range fails its own cell without allocating', () => {
    const res = evaluateWorkbook(
      single({ A1: f('SUM(B1:XFD1048576)'), A2: f('1+1') }),
      {},
      { blankAs: 'blank' },
    );
    expect(res.get('S!A1')).toMatchObject({ ok: false, error: { code: 'STEP_LIMIT_EXCEEDED' } });
    expect(res.get('S!A2')).toMatchObject({ ok: true });
  });

  it('a 3-D range across many sheets is bounded by sheets × cells, not by cells alone', () => {
    const sheets = Array.from({ length: 30 }, (_, i) => ({
      name: `T${i}`,
      cells: { A1: { kind: 'number', value: '1' } as WorkbookCell },
    }));
    sheets.push({ name: 'TOTAL', cells: { A1: f("SUM('T0:T29'!A1:A2000)") } });
    const res = evaluateWorkbook({ sheets }, {}, { blankAs: 'blank', maxRangeCells: 50_000 });
    // 30 sheets × 2000 rows = 60 000 cells > 50 000 cap
    expect(res.get('TOTAL!A1')).toMatchObject({ ok: false, error: { code: 'STEP_LIMIT_EXCEEDED' } });
  });

  it('deeply nested parentheses are a parse error for that cell, not a stack overflow', () => {
    const deep = `${'('.repeat(5000)}1${')'.repeat(5000)}`;
    const res = evaluateWorkbook(single({ A1: f(deep), A2: f('2') }), {}, { blankAs: 'blank' });
    expect(res.get('S!A1')).toMatchObject({ ok: false });
    expect(res.get('S!A2')).toMatchObject({ ok: true });
  });

  it('a reference to a cell address outside the sheet limits does not crash', () => {
    const res = evaluateWorkbook(single({ A1: f('ZZZZ99999999+1') }), {}, { blankAs: 'blank' });
    expect(res.get('S!A1')).toBeDefined();
  });

  it('a formula whose source is empty or whitespace fails that cell only', () => {
    const res = evaluateWorkbook(single({ A1: f(''), A2: f('   '), A3: f('1') }), {}, { blankAs: 'blank' });
    expect(res.get('S!A1')).toMatchObject({ ok: false });
    expect(res.get('S!A2')).toMatchObject({ ok: false });
    expect(res.get('S!A3')).toMatchObject({ ok: true });
  });

  it('an external-workbook reference is rejected, not resolved', () => {
    const res = evaluateWorkbook(single({ A1: f("'[Book1.xlsx]Sheet1'!A1") }), {}, { blankAs: 'blank' });
    expect(res.get('S!A1')).toMatchObject({ ok: false });
  });

  it('lower-case addresses in cell keys and references are the same cell', () => {
    const model = single({ A1: n(), B1: f('a1*2') });
    const ev = new WorkbookEvaluator(model, { 'S!A1': '4' }, { blankAs: 'blank' });
    expect(ev.get('S', 'b1')).toEqual({ ok: true, value: { type: 'number', value: '8' } });
    ev.setInput('S', 'a1', '5');
    expect(ev.get('S', 'B1')).toEqual({ ok: true, value: { type: 'number', value: '10' } });
  });
});

describe('incremental recompute edge cases', () => {
  it('editing an input that only a cycle reads changes nothing and does not loop', () => {
    const model = single({ A1: n(), B1: f('C1+A1'), C1: f('B1+1') });
    const ev = new WorkbookEvaluator(model, {}, { blankAs: 'blank' });
    expect(ev.get('S', 'B1')).toMatchObject({ ok: false, error: { code: 'CYCLE_DETECTED' } });
    const changed = ev.setInput('S', 'A1', '9');
    expect(changed).toEqual([]);
    expect(ev.get('S', 'C1')).toMatchObject({ ok: false, error: { code: 'CYCLE_DETECTED' } });
  });

  it('a formula that read a failed range recovers once the offending input is fixed', () => {
    const model = single({ A1: n(), A2: n(), A3: f('SUM(A1:A2)') });
    const ev = new WorkbookEvaluator(model, { 'S!A1': 'abc', 'S!A2': '2' }, { blankAs: 'blank' });
    expect(ev.get('S', 'A3')).toMatchObject({ ok: false, error: { code: 'TYPE_ERROR' } });
    const changed = ev.setInput('S', 'A1', '5');
    expect(changed).toEqual(['S!A3']);
    expect(ev.get('S', 'A3')).toEqual({ ok: true, value: { type: 'number', value: '7' } });
  });

  it('recomputes a diamond once per cell and in a valid order', () => {
    const model = single({
      A1: n(),
      B1: f('A1+1'),
      C1: f('A1*2'),
      D1: f('B1+C1'),
    });
    const ev = new WorkbookEvaluator(model, { 'S!A1': '1' }, { blankAs: 'blank' });
    const changed = ev.setInput('S', 'A1', '10');
    expect(changed.sort()).toEqual(['S!B1', 'S!C1', 'S!D1']);
    expect(ev.get('S', 'D1')).toEqual({ ok: true, value: { type: 'number', value: '31' } });
  });

  it('a 3-D total reacts to an edit on any sheet inside the span', () => {
    const model: WorkbookModel = {
      sheets: [
        { name: 'T1', cells: { A1: n() } },
        { name: 'T2', cells: { A1: n() } },
        { name: 'T3', cells: { A1: n() } },
        { name: 'TOTAL', cells: { A1: f("SUM('T1:T3'!A1)") } },
      ],
    };
    const ev = new WorkbookEvaluator(model, { 'T1!A1': '1', 'T2!A1': '2', 'T3!A1': '3' }, { blankAs: 'blank' });
    expect(ev.setInput('T2', 'A1', '20')).toEqual(['TOTAL!A1']);
    expect(ev.get('TOTAL', 'A1')).toEqual({ ok: true, value: { type: 'number', value: '24' } });
  });
});

describe('formatFormula is a true inverse of parseFormula', () => {
  const samples = [
    '1',
    '1.5',
    '-1',
    '--1',
    '-(1+2)',
    '1-(2-3)',
    '(1-2)-3',
    '1-2-3',
    '2*(3+4)*5',
    '(2*3)+4',
    '2^3'.replace('^', '*'),
    'A1&B1&C1',
    'A1&(B1&C1)',
    'IF(A1>=1,"x""y","z")',
    'AND(A1,B1,OR(C1,D1))',
    'ROUND(A1/B1,2)',
    "SUM('Tổ 1:Tổ 3'!C6:D7)",
    "'Ghi chú'!A1",
    "'It''s'!A1",
    'PREV(A1)',
    'IF(A1=B1,TRUE,FALSE)',
    'A1<>B1',
    '(A1=B1)=(C1=D1)',
  ];

  it.each(samples)('%s', (src) => {
    const first = parseFormula(src);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const text = formatFormula(first.expr);
    const second = parseFormula(text);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    // The two trees must be identical, which is stronger than comparing text.
    expect(second.expr).toEqual(first.expr);
  });
});
