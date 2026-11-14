import * as ExcelJS from 'exceljs';
import { buildCustomSummary } from '../views/custom-summary';
import type { CustomSummary, CustomSummaryInput } from '../views/custom-summary';
import {
  buildCustomWorkbook,
  CUSTOM_FILE_MAX_CELLS,
  CUSTOM_HEADER_ROW,
  CustomFileTooLargeError,
} from './custom-workbook';

const field = (fieldKey: string, itemKey: string, code: string, label: string, parentItemKey: string | null) => ({
  fieldKey,
  itemKey,
  code,
  label,
  unit: 'vụ' as string | null,
  type: 'NUM' as const,
  aggregate: 'SUM' as const,
  blankPolicy: 'ZERO' as const,
  parentItemKey,
});
const base: CustomSummaryInput = {
  reportName: 'Báo cáo tháng',
  periodKey: '2026-10',
  periodStatus: 'OPEN',
  mode: 'SUBMITTED',
  fields: [
    field('S!C3', 'k11', '1.1', 'Tin báo mới', 'g1'),
    field('S!C4', 'k12', '1.2', 'Tin báo đã giải quyết', 'g1'),
    field('S!C5', 'k2', '2', 'Số vụ khởi tố', null),
    field('S!C6', 'k3', '3', 'Số bị can', null),
  ],
  groups: [{ itemKey: 'g1', code: '1', name: 'Tin báo tội phạm', parentItemKey: null }],
  teams: [
    { teamId: 'A', name: 'Tổ A', obligation: 'REQUIRED', state: 'SUBMITTED', ownedFieldKeys: ['S!C3', 'S!C4', 'S!C5'], values: { 'S!C3': '11', 'S!C4': '12', 'S!C5': '20' } },
    { teamId: 'B', name: 'Tổ B', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: { 'S!C3': '101', 'S!C4': '102', 'S!C5': '200', 'S!C6': '300' } },
    { teamId: 'C', name: 'Tổ C', obligation: 'REQUIRED', state: 'DRAFT', ownedFieldKeys: null, values: { 'S!C3': '1001', 'S!C5': '2000' } },
  ],
  definition: { title: null, showFilterLine: true, itemKeys: null, teamIds: null, teamColumns: true },
};

async function open(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  expect(workbook.worksheets).toHaveLength(1);
  return workbook.worksheets[0];
}
/** A row of the sheet as plain values, empty cells as null, to the given width. */
const rowValues = (sheet: ExcelJS.Worksheet, r: number, width: number) =>
  Array.from({ length: width }, (_, i) => sheet.getRow(r).getCell(i + 1).value ?? null);

/** What the file must show for a row of the summary, worked out here and not by the code under test. */
function expectedRow(summary: CustomSummary, index: number): unknown[] {
  const row = summary.rows[index];
  const number = (v: string | null) => (v === null ? null : Number(v));
  const mark = (m: string | null) =>
    m === 'NOT_ASSIGNED' ? '—' : m === 'EXEMPT' ? 'miễn nộp' : m === 'NOT_COUNTED' ? (summary.mode === 'APPROVED' ? 'chưa duyệt' : 'chưa nộp') : null;
  return [row.code ?? '', row.label, row.unit ?? '', number(row.total), ...row.cells.map((c) => (c.mark ? mark(c.mark) : number(c.value)))];
}

describe('buildCustomWorkbook', () => {
  it('one sheet: the title, the filter line, the table with every cell of the summary, then the notes', async () => {
    const summary = buildCustomSummary({ ...base, definition: { ...base.definition, itemKeys: ['k11', 'k2', 'k3'] } });
    const sheet = await open(await buildCustomWorkbook(summary));
    const width = summary.columns.length;

    expect(sheet.name).toBe('Báo cáo');
    expect(sheet.getCell('A1').value).toBe('Báo cáo tháng — kỳ 2026-10');
    expect(sheet.getCell('A2').value).toBe('Đơn vị: tất cả 3 tổ · Số liệu: đã nộp + đã duyệt');
    expect(rowValues(sheet, CUSTOM_HEADER_ROW, width)).toEqual(['Mã', 'Tiêu chí', 'ĐVT', 'Tổng', 'Tổ A', 'Tổ B', 'Tổ C']);

    // Every row, every cell.
    summary.rows.forEach((_, i) => {
      expect(rowValues(sheet, CUSTOM_HEADER_ROW + 1 + i, width)).toEqual(expectedRow(summary, i));
    });
    // Spelled out once by hand as well, so the comparison above cannot be vacuous.
    expect(rowValues(sheet, CUSTOM_HEADER_ROW + 1, width)).toEqual(['1', 'Tin báo tội phạm', '', 226, 23, 203, 'chưa nộp']);
    expect(rowValues(sheet, CUSTOM_HEADER_ROW + 4, width)).toEqual(['3', 'Số bị can', 'vụ', 300, '—', 300, 'chưa nộp']);

    // Under the table: an empty row, the heading of the notes, one line per note.
    const afterTable = CUSTOM_HEADER_ROW + summary.rows.length + 1;
    expect(rowValues(sheet, afterTable, width).every((v) => v === null)).toBe(true);
    expect(sheet.getCell(afterTable + 1, 1).value).toBe('Ghi chú:');
    expect(summary.notes.map((n) => n.code)).toEqual(['PERIOD_OPEN', 'GROUP_INCLUDES_UNLISTED']);
    expect(sheet.getCell(afterTable + 2, 1).value).toBe(
      '• Kỳ báo cáo chưa khoá sổ: số liệu là số tạm tính (đã nộp + đã duyệt) và còn có thể thay đổi.',
    );
    expect(sheet.getCell(afterTable + 3, 1).value).toBe(
      '• Mục "1 Tin báo tội phạm" là tổng của mọi tiêu chí con, kể cả những tiêu chí không được liệt kê trong báo cáo này.',
    );
    expect(sheet.rowCount).toBe(afterTable + 3);
  });

  it('holds plain values only: no formula anywhere', async () => {
    const sheet = await open(await buildCustomWorkbook(buildCustomSummary(base)));
    sheet.eachRow((row) => row.eachCell((cell) => expect(cell.type).not.toBe(ExcelJS.ValueType.Formula)));
  });

  it('without the filter line and without team columns: row 2 is empty and the table has four columns', async () => {
    const summary = buildCustomSummary({
      ...base,
      periodStatus: 'FINALIZED',
      mode: 'APPROVED',
      definition: { ...base.definition, title: 'Báo cáo gửi Bộ', showFilterLine: false, teamColumns: false },
    });
    const sheet = await open(await buildCustomWorkbook(summary));
    expect(sheet.getCell('A1').value).toBe('Báo cáo gửi Bộ');
    expect(sheet.getCell('A2').value).toBeNull();
    expect(rowValues(sheet, CUSTOM_HEADER_ROW, 6)).toEqual(['Mã', 'Tiêu chí', 'ĐVT', 'Tổng', null, null]);
    expect(rowValues(sheet, CUSTOM_HEADER_ROW + 2, 6)).toEqual(['1.1', 'Tin báo mới', 'vụ', 101, null, null]);
    // A closed period with nothing left out has nothing to note: the sheet ends with the table.
    expect(summary.notes).toEqual([]);
    expect(sheet.rowCount).toBe(CUSTOM_HEADER_ROW + summary.rows.length);
  });

  it('a heading with nothing to add up is an empty cell, never a 0: no team counted, or a team that typed nothing under it', async () => {
    const blankTeam = { teamId: 'D', name: 'Tổ D', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: { 'S!C5': '7' } };
    const draftTeam = { ...blankTeam, teamId: 'E', name: 'Tổ E', state: 'DRAFT', values: { 'S!C3': '4' } };
    const summary = buildCustomSummary({
      ...base,
      mode: 'APPROVED',
      fields: base.fields.map((f) => ({ ...f, blankPolicy: 'IGNORE' as const })),
      teams: [blankTeam, draftTeam],
    });
    expect(summary.rows[0]).toMatchObject({ kind: 'GROUP', total: null, cells: [{ value: null, mark: 'BLANK' }, { value: null, mark: 'NOT_COUNTED' }] });

    const sheet = await open(await buildCustomWorkbook(summary));

    expect(rowValues(sheet, CUSTOM_HEADER_ROW + 1, 6)).toEqual(['1', 'Tin báo tội phạm', '', null, null, 'chưa duyệt']);
    expect(rowValues(sheet, CUSTOM_HEADER_ROW + 2, 6)).toEqual(['1.1', 'Tin báo mới', 'vụ', null, null, 'chưa duyệt']);
    // A zero that was typed is written as the number 0.
    const zero = buildCustomSummary({ ...base, mode: 'APPROVED', teams: [{ ...blankTeam, values: { 'S!C3': '0' } }] });
    expect(rowValues(await open(await buildCustomWorkbook(zero)), CUSTOM_HEADER_ROW + 1, 5)).toEqual(['1', 'Tin báo tội phạm', '', 0, 0]);
  });

  it('text that looks like a formula stays text: in the title, a name, a team, a typed value', async () => {
    const summary = buildCustomSummary({
      ...base,
      fields: [
        { ...field('S!C3', 'k1', '=1+1', '=HYPERLINK("http://x","y")', null), unit: '+vụ' },
        { ...field('S!C4', 'k2', '2', 'Ghi chú', null), type: 'TEXT', aggregate: 'NONE', unit: null },
      ],
      groups: [],
      teams: [{ teamId: 'A', name: '=Tổ A', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: { 'S!C3': '5', 'S!C4': '=cmd|x' } }],
      definition: { ...base.definition, title: '=SUM(A1)' },
    });
    const sheet = await open(await buildCustomWorkbook(summary));
    expect(sheet.getCell('A1').value).toBe("'=SUM(A1)");
    expect(rowValues(sheet, CUSTOM_HEADER_ROW, 5)).toEqual(['Mã', 'Tiêu chí', 'ĐVT', 'Tổng', "'=Tổ A"]);
    expect(rowValues(sheet, CUSTOM_HEADER_ROW + 1, 5)).toEqual(["'=1+1", `'=HYPERLINK("http://x","y")`, "'+vụ", 5, 5]);
    expect(rowValues(sheet, CUSTOM_HEADER_ROW + 2, 5)).toEqual(['2', 'Ghi chú', '', null, "'=cmd|x"]);
  });

  it('a figure too long for Excel to hold exactly is written as the text it is, never rounded', async () => {
    const summary = buildCustomSummary({
      ...base,
      fields: [field('S!C3', 'k1', '1', 'Lớn', null)],
      groups: [],
      teams: [{ teamId: 'A', name: 'Tổ A', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: { 'S!C3': '123456789012345678' } }],
    });
    const sheet = await open(await buildCustomWorkbook(summary));
    expect(rowValues(sheet, CUSTOM_HEADER_ROW + 1, 5)).toEqual(['1', 'Lớn', 'vụ', '123456789012345678', '123456789012345678']);
  });

  it('refuses a table beyond the size one file may safely hold', async () => {
    const summary = buildCustomSummary(base);
    const row = summary.rows[0];
    const huge: CustomSummary = { ...summary, rows: Array.from({ length: CUSTOM_FILE_MAX_CELLS / 3 + 1 }, () => row) };
    await expect(buildCustomWorkbook(huge)).rejects.toBeInstanceOf(CustomFileTooLargeError);
  });
});
