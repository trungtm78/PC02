import * as ExcelJS from 'exceljs';
import { buildOfficialWorkbook, OFFICIAL_SUMMARY_SHEET, type OfficialWorkbookInput } from './official-workbook';

const field = (fieldKey: string, label: string, over: Record<string, unknown> = {}) => ({
  fieldKey,
  label,
  code: null,
  unit: null,
  type: 'NUM' as const,
  aggregate: 'SUM' as const,
  blankPolicy: 'ZERO' as const,
  ...over,
});

function input(over: Partial<OfficialWorkbookInput> = {}): OfficialWorkbookInput {
  return {
    reportName: 'Thống kê tháng',
    periodKey: '2026-10',
    fields: [
      field('S!C2', 'Số tin báo mới', { code: '1.1', unit: 'tin' }),
      field('S!C3', 'Số vụ đình chỉ', { code: '2.2', unit: 'vụ' }),
    ],
    teams: [
      { teamId: 't1', name: 'Tổ 1', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: { 'S!C2': '20', 'S!C3': '4' } },
      // Tổ 2 owes both, approved, but left the second one blank.
      { teamId: 't2', name: 'Tổ 2', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: { 'S!C2': '25', 'S!C3': null } },
      // Tổ 3 reports only the first criterion.
      { teamId: 't3', name: 'Tổ 3', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: ['S!C2'], values: { 'S!C2': '12', 'S!C3': '999' } },
    ],
    ...over,
  };
}

async function open(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  return wb;
}
const rowValues = (ws: ExcelJS.Worksheet, n: number) =>
  // `values` is sparse (an empty cell is a hole) and stops at the last cell that has something.
  Array.from((ws.getRow(n).values as unknown[]).slice(1), (v) => v ?? null);

describe('buildOfficialWorkbook: the file a closed period is kept as', () => {
  it('the first sheet is the summary: one row per criterion with the total, received / owed, percent, then one column per team', async () => {
    const wb = await open(await buildOfficialWorkbook(input()));
    const ws = wb.worksheets[0];

    expect(ws.name).toBe(OFFICIAL_SUMMARY_SHEET);
    const header = ws.getRow(4).values as unknown[];
    expect(header.slice(1)).toEqual(['Mã', 'Tiêu chí', 'ĐVT', 'Tổng', 'Đã nhận/Phải nộp', '%', 'Tổ 1', 'Tổ 2', 'Tổ 3']);
    expect(rowValues(ws, 5)).toEqual(['1.1', 'Số tin báo mới', 'tin', 57, '3/3', '100%', 20, 25, 12]);
  });

  it('a team that owes a criterion and left it blank is shown as missing; a team not given it is shown as not assigned and is in neither count', async () => {
    const wb = await open(await buildOfficialWorkbook(input()));
    const ws = wb.worksheets[0];

    // Tổ 3's stray 999 for a criterion it does not report is nowhere: not in the total, not in its cell.
    expect(rowValues(ws, 6)).toEqual(['2.2', 'Số vụ đình chỉ', 'vụ', 4, '1/2', '50%', 4, 'thiếu', '—']);
    expect((ws.getCell('H6').fill as ExcelJS.FillPattern)?.fgColor?.argb).toBe('FFFFC7CE');
  });

  it('after the summary, each team has a sheet with only its own criteria', async () => {
    const wb = await open(await buildOfficialWorkbook(input()));

    expect(wb.worksheets.map((w) => w.name)).toEqual([OFFICIAL_SUMMARY_SHEET, 'Tổ 1', 'Tổ 2', 'Tổ 3']);
    const t3 = wb.getWorksheet('Tổ 3')!;
    expect(rowValues(t3, 4)).toEqual(['Mã', 'Tiêu chí', 'ĐVT', 'Giá trị']);
    expect(rowValues(t3, 5)).toEqual(['1.1', 'Số tin báo mới', 'tin', 12]);
    expect(t3.rowCount).toBe(5);
    const t2 = wb.getWorksheet('Tổ 2')!;
    // The criterion it left blank is still listed on its sheet, with an empty value.
    expect(rowValues(t2, 6)).toEqual(['2.2', 'Số vụ đình chỉ', 'vụ']);
  });

  it('a team that is not approved is not in the totals and is marked so, not shown as zero', async () => {
    const data = input();
    data.teams[1] = { ...data.teams[1], state: 'SUBMITTED', values: { 'S!C2': '25', 'S!C3': '6' } };

    const wb = await open(await buildOfficialWorkbook(data));
    const ws = wb.worksheets[0];

    expect(rowValues(ws, 5)).toEqual(['1.1', 'Số tin báo mới', 'tin', 32, '2/3', '67%', 20, 'chưa duyệt', 12]);
    expect(rowValues(ws, 6)).toEqual(['2.2', 'Số vụ đình chỉ', 'vụ', 4, '1/2', '50%', 4, 'chưa duyệt', '—']);
  });

  it('an exempt team owes nothing: it is not counted and shown as exempt', async () => {
    const data = input();
    data.teams[1] = { ...data.teams[1], obligation: 'EXEMPT' };

    const ws = (await open(await buildOfficialWorkbook(data))).worksheets[0];

    expect(rowValues(ws, 5)).toEqual(['1.1', 'Số tin báo mới', 'tin', 32, '2/2', '100%', 20, 'miễn nộp', 12]);
  });

  it('a criterion nobody owes shows a dash for the ratio instead of dividing by zero', async () => {
    const data = input();
    data.teams = data.teams.map((t) => ({ ...t, ownedFieldKeys: ['S!C2'] }));

    const ws = (await open(await buildOfficialWorkbook(data))).worksheets[0];

    expect(rowValues(ws, 6)).toEqual(['2.2', 'Số vụ đình chỉ', 'vụ', null, '0/0', '—', '—', '—', '—']);
  });

  it('text that looks like a formula is written as text, and two teams with the same name get distinct sheets', async () => {
    const data = input({ fields: [field('S!C2', '=HYPERLINK("http://x","a")')] });
    data.teams = [
      { teamId: 'a', name: 'Tổ: 1/2', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: {} },
      { teamId: 'b', name: 'Tổ: 1/2', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: {} },
    ];

    const wb = await open(await buildOfficialWorkbook(data));

    expect(wb.worksheets[0].getCell('B5').formula).toBeUndefined();
    expect(String(wb.worksheets[0].getCell('B5').value).startsWith("'=")).toBe(true);
    const names = wb.worksheets.slice(1).map((w) => w.name);
    expect(new Set(names).size).toBe(2);
    expect(names.every((n) => n.length <= 31 && !/[*?:\\/[\]]/.test(n))).toBe(true);
  });

  it('a figure too long for Excel to hold exactly is written as text, never rounded', async () => {
    const data = input();
    data.teams = [{ teamId: 't1', name: 'Tổ 1', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: { 'S!C2': '12345678901234567890', 'S!C3': '1' } }];

    const ws = (await open(await buildOfficialWorkbook(data))).worksheets[0];

    expect(ws.getCell('D5').value).toBe('12345678901234567890');
    expect(ws.getCell('G5').value).toBe('12345678901234567890');
  });
});
