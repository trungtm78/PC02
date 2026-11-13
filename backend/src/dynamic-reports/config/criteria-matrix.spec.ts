import * as ExcelJS from 'exceljs';
import { buildCriteriaMatrix, MATRIX_MARK, parseCriteriaMatrix } from './criteria-matrix';

const fields = [
  { itemKey: 'tin-moi', code: '1.1', label: 'Số tin báo mới' },
  { itemKey: 'tin-cu', code: '1.2', label: 'Số tin báo đã giải quyết' },
  { itemKey: 'khoi-to', code: '2.1', label: 'Số vụ khởi tố' },
];
const teams = [
  { teamId: 't1', name: 'Tổ 1', itemKeys: null },
  { teamId: 't2', name: 'Tổ 2', itemKeys: ['tin-moi', 'khoi-to'] },
];

async function edit(buffer: Buffer, change: (ws: ExcelJS.Worksheet) => void): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  change(wb.worksheets[0]);
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

describe('criteria matrix as an Excel file', () => {
  it('writes one row per criterion and one column per team, with a mark where the team reports it', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildCriteriaMatrix(fields, teams)) as never);
    const ws = wb.worksheets[0];

    expect([ws.getCell('B3').value, ws.getCell('C3').value, ws.getCell('D3').value, ws.getCell('E3').value]).toEqual([
      'Mã',
      'Tiêu chí',
      'Tổ 1',
      'Tổ 2',
    ]);
    expect([ws.getCell('D4').value, ws.getCell('E4').value]).toEqual([MATRIX_MARK, MATRIX_MARK]);
    // Tổ 2 does not report "tin-cu"; Tổ 1 (no subset) reports everything.
    expect([ws.getCell('D5').value, ws.getCell('E5').value]).toEqual([MATRIX_MARK, null]);
  });

  it('round trip: a file that was not touched reads back as no change at all', async () => {
    const parsed = await parseCriteriaMatrix(await buildCriteriaMatrix(fields, teams), fields, teams);

    expect(parsed.errors).toEqual([]);
    expect(parsed.teams).toEqual([
      { teamId: 't1', name: 'Tổ 1', itemKeys: null, added: [], removed: [] },
      { teamId: 't2', name: 'Tổ 2', itemKeys: ['tin-moi', 'khoi-to'], added: [], removed: [] },
    ]);
  });

  it('reads the marks the author changed, and says what each team gains and loses', async () => {
    const file = await edit(await buildCriteriaMatrix(fields, teams), (ws) => {
      ws.getCell('D5').value = null; // Tổ 1 no longer reports tin-cu
      ws.getCell('E5').value = 'X'; // Tổ 2 now does (any mark counts, whatever the case)
      ws.getCell('E6').value = '  '; // blanks are not a mark: Tổ 2 loses khoi-to
    });

    const parsed = await parseCriteriaMatrix(file, fields, teams);

    expect(parsed.errors).toEqual([]);
    expect(parsed.teams).toEqual([
      { teamId: 't1', name: 'Tổ 1', itemKeys: ['tin-moi', 'khoi-to'], added: [], removed: ['tin-cu'] },
      { teamId: 't2', name: 'Tổ 2', itemKeys: ['tin-moi', 'tin-cu'], added: ['tin-cu'], removed: ['khoi-to'] },
    ]);
  });

  it('a team marked for every criterion is "all" again', async () => {
    const file = await edit(await buildCriteriaMatrix(fields, teams), (ws) => {
      ws.getCell('E5').value = 'x';
    });
    const parsed = await parseCriteriaMatrix(file, fields, teams);
    expect(parsed.teams[1]).toMatchObject({ itemKeys: null, added: ['tin-cu'], removed: [] });
  });

  it('refuses a file that would leave a team with nothing, or that is not the matrix of this report', async () => {
    const empty = await edit(await buildCriteriaMatrix(fields, teams), (ws) => {
      for (const r of [4, 5, 6]) ws.getCell(`E${r}`).value = null;
    });
    expect((await parseCriteriaMatrix(empty, fields, teams)).errors).toEqual([{ code: 'MATRIX_TEAM_EMPTY', teamId: 't2', name: 'Tổ 2' }]);

    const foreign = await edit(await buildCriteriaMatrix(fields, teams), (ws) => {
      ws.getCell('A5').value = 'khong-co';
      ws.getCell('E1').value = 't9';
    });
    const parsed = await parseCriteriaMatrix(foreign, fields, teams);
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        { code: 'MATRIX_CRITERION_UNKNOWN', row: 5 },
        { code: 'MATRIX_CRITERION_MISSING', itemKey: 'tin-cu' },
        { code: 'MATRIX_TEAM_UNKNOWN', column: 'E' },
        { code: 'MATRIX_TEAM_MISSING', teamId: 't2', name: 'Tổ 2' },
      ]),
    );
  });

  it('a file that is not a workbook of this kind at all is one clear error', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('x').getCell('A1').value = 'hello';
    const parsed = await parseCriteriaMatrix(Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer), fields, teams);
    expect(parsed.errors).toEqual([{ code: 'MATRIX_NOT_RECOGNISED' }]);
  });
});
