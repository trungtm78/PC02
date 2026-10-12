import * as fs from 'fs';
import * as path from 'path';
import { reconcileFieldsWithWorkbook } from './publish-reconcile';
import type { SubmittedField } from './publish-reconcile';
import { parseTemplate } from '../template/parser';
import type { ParseTemplateResult } from '../template/types';

const REAL = path.join(__dirname, '../../../test/fixtures/dynamic-reports/real');

function parsedOf(over: Partial<ParseTemplateResult> = {}): ParseTemplateResult {
  return {
    dateSystem: '1900',
    fields: [
      { sheetKey: 'S', address: 'C6', fieldKey: 'S!C6', label: 'a', type: 'NUM', format: '', aggregate: 'SUM', source: 'TOKEN' },
    ],
    formulas: [{ sheetKey: 'S', address: 'C9', expression: 'C6+1' }],
    issues: [],
    markableCells: [
      { sheetKey: 'S', address: 'C7', suggestedLabel: null },
      { sheetKey: 'S', address: 'D7', suggestedLabel: 'x' },
    ],
    totalCells: 10,
    inputCellCount: 1,
    layout: { sheetOrder: ['S'], sheets: [] },
    dataValidations: [],
    ...over,
  };
}

const token = (over: Partial<SubmittedField> = {}): SubmittedField => ({
  sheetKey: 'S', address: 'C6', fieldKey: 'S!C6', type: 'NUM', aggregate: 'SUM', source: 'TOKEN', ...over,
});
const web = (address: string, over: Partial<SubmittedField> = {}): SubmittedField => ({
  sheetKey: 'S', address, fieldKey: `S!${address}`, type: 'NUM', aggregate: 'SUM', source: 'WEB', ...over,
});

const run = (fields: SubmittedField[], parsed = parsedOf(), sheets = ['S']) =>
  reconcileFieldsWithWorkbook(parsed, sheets, fields).problems;

describe('reconcileFieldsWithWorkbook', () => {
  it('accepts exactly what the file declares plus eligible web marks', () => {
    expect(run([token(), web('C7'), web('D7')])).toEqual([]);
  });

  it('rejects a web mark on a formula cell', () => {
    const p = run([token(), web('C9')]);
    expect(p.join('\n')).toContain('S!C9: là ô công thức');
  });

  it('rejects a web mark on a cell the parser did not offer (locked, merged, hidden…)', () => {
    const p = run([token(), web('Z99')]);
    expect(p.join('\n')).toContain('S!Z99: không thể đặt làm ô nhập');
  });

  it('rejects a TOKEN field the file has no token for', () => {
    const p = run([token(), token({ address: 'C8', fieldKey: 'S!C8' })]);
    expect(p.join('\n')).toContain('S!C8: khai báo theo token nhưng file mẫu không có token');
  });

  it('rejects a TOKEN field whose type or aggregate disagrees with the token', () => {
    expect(run([token({ type: 'TEXT' })]).join('\n')).toContain('khác token');
    expect(run([token({ aggregate: 'AVG' })]).join('\n')).toContain('khác token');
  });

  it('rejects dropping an input the template declares', () => {
    const p = run([web('C7')]);
    expect(p.join('\n')).toContain('S!C6: file mẫu khai báo ô nhập (token) nhưng danh sách gửi lên thiếu');
  });

  it('rejects a field key that is not Sheet!Address (the key every value is stored under)', () => {
    const p = run([token({ fieldKey: 'whatever' }), ]);
    expect(p.join('\n')).toContain('mã ô phải là "S!C6"');
  });

  it('rejects a duplicate declaration', () => {
    expect(run([token(), token()]).join('\n')).toContain('khai báo trùng');
  });

  it('rejects a sheet that is not part of the report', () => {
    expect(run([token({ sheetKey: 'Other', fieldKey: 'Other!C6' })]).join('\n')).toContain(
      'sheet không nằm trong danh sách',
    );
  });

  it('rejects a lower-case or malformed address', () => {
    expect(run([token(), web('c7', { fieldKey: 'S!c7' })]).join('\n')).toContain('địa chỉ ô không hợp lệ');
    expect(run([token(), web('7C', { fieldKey: 'S!7C' })]).join('\n')).toContain('địa chỉ ô không hợp lệ');
  });

  it('a web mark on a cell that already has a token is refused (the token owns it)', () => {
    const p = run([web('C6')], parsedOf({ markableCells: [] }));
    expect(p.join('\n')).toContain('không thể đặt làm ô nhập');
  });

  it('caps how many problems it reports but says how many were left out', () => {
    const many = Array.from({ length: 20 }, (_, i) => web(`Z${i + 1}`));
    const p = run([token(), ...many]);
    expect(p).toHaveLength(9);
    expect(p[8]).toBe('… và 12 vấn đề khác.');
  });

  it('a TOKEN field on a formula cell is refused as a formula, not as a token mismatch', () => {
    const parsed = parsedOf({ formulas: [{ sheetKey: 'S', address: 'C6', expression: '1+1' }] });
    expect(run([token()], parsed).join('\n')).toContain('là ô công thức');
  });
});

describe('against the real templates (parser output, not fixtures written by hand)', () => {
  it('HSLN: the fields the parser derives reconcile cleanly with themselves', async () => {
    const buf = fs.readFileSync(path.join(REAL, 'hsln_17_sheets.xlsx'));
    const parsed = await parseTemplate(buf, ['Đội 3']);
    // The wizard's accepted workflow: token fields + web marks on offered cells.
    const fields: SubmittedField[] = parsed.fields.map((f) => ({
      sheetKey: f.sheetKey, address: f.address, fieldKey: f.fieldKey, type: f.type, aggregate: f.aggregate, source: 'TOKEN' as const,
    }));
    const marks = parsed.markableCells.slice(0, 33).map((c) => web(c.address, { sheetKey: c.sheetKey, fieldKey: `${c.sheetKey}!${c.address}` }));
    expect(reconcileFieldsWithWorkbook(parsed, ['Đội 3'], [...fields, ...marks]).problems).toEqual([]);
    expect(marks.length).toBeGreaterThan(0);
  });

  it('HSLN: a tampered request that unlocks a formula cell is caught', async () => {
    const buf = fs.readFileSync(path.join(REAL, 'a10_99_formulas.xlsx'));
    const parsed = await parseTemplate(buf, ['A10']);
    expect(parsed.formulas.length).toBeGreaterThan(0);
    const f = parsed.formulas[0];
    const tampered = web(f.address, { sheetKey: f.sheetKey, fieldKey: `${f.sheetKey}!${f.address}` });
    expect(reconcileFieldsWithWorkbook(parsed, ['A10'], [tampered]).problems.join('\n')).toContain('là ô công thức');
  });
});
