import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { buildCriteriaMatrix, MATRIX_LIMITS, MATRIX_MARK, parseCriteriaMatrix } from './criteria-matrix';

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

  describe('a file that cannot be read as a yes or a no is refused, not guessed', () => {
    const errorsOf = async (change: (ws: ExcelJS.Worksheet) => void) =>
      (await parseCriteriaMatrix(await edit(await buildCriteriaMatrix(fields, teams), change), fields, teams)).errors;

    it('the same criterion on two rows: the second row is named, nothing is applied', async () => {
      const errors = await errorsOf((ws) => {
        ws.getCell('A7').value = 'tin-cu';
        ws.getCell('E7').value = 'x';
      });
      expect(errors).toEqual([{ code: 'MATRIX_CRITERION_DUPLICATE', row: 7 }]);
    });

    it('the same team on two columns: the second column is named', async () => {
      const errors = await errorsOf((ws) => {
        ws.getCell('F1').value = 't2';
        ws.getCell('F5').value = 'x';
      });
      expect(errors).toEqual([{ code: 'MATRIX_TEAM_DUPLICATE', column: 'F' }]);
    });

    it('a formula in a mark cell, even one that shows nothing', async () => {
      const errors = await errorsOf((ws) => {
        ws.getCell('E5').value = { formula: '""', result: '' };
      });
      expect(errors).toEqual([{ code: 'MATRIX_CELL_NOT_PLAIN', cell: 'E5' }]);
    });

    it('merged mark cells: one mark would answer for both', async () => {
      const errors = await errorsOf((ws) => {
        ws.mergeCells('E4:E5');
      });
      expect(errors).toEqual([
        { code: 'MATRIX_CELL_NOT_PLAIN', cell: 'E4' },
        { code: 'MATRIX_CELL_NOT_PLAIN', cell: 'E5' },
      ]);
    });

    it('rich text is read by its words: blanks are not a mark, a letter is', async () => {
      const parsed = await parseCriteriaMatrix(
        await edit(await buildCriteriaMatrix(fields, teams), (ws) => {
          ws.getCell('D5').value = { richText: [{ text: '  ' }, { text: ' ' }] };
          ws.getCell('E5').value = { richText: [{ font: { bold: true }, text: 'x' }] };
        }),
        fields,
        teams,
      );
      expect(parsed.errors).toEqual([]);
      expect(parsed.teams[0]).toMatchObject({ removed: ['tin-cu'] });
      expect(parsed.teams[1]).toMatchObject({ itemKeys: null, added: ['tin-cu'] });
    });
  });

  describe('a hostile or broken upload is refused before it costs anything', () => {
    it('bytes that are not a workbook', async () => {
      expect((await parseCriteriaMatrix(Buffer.from('not a workbook at all'), fields, teams)).errors).toEqual([{ code: 'MATRIX_NOT_RECOGNISED' }]);
    });

    it('a zip that is not a workbook', async () => {
      const zip = new JSZip();
      zip.file('hello.txt', 'hello');
      const parsed = await parseCriteriaMatrix(await zip.generateAsync({ type: 'nodebuffer' }), fields, teams);
      expect(parsed.errors).toEqual([{ code: 'MATRIX_NOT_RECOGNISED' }]);
    });

    it('an archive that would unpack far beyond what a matrix is: refused by its declared size, never unpacked', async () => {
      const zip = new JSZip();
      zip.file('xl/worksheets/sheet1.xml', Buffer.alloc(MATRIX_LIMITS.MAX_UNCOMPRESSED_BYTES + 1, 0x20));
      const bomb = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      expect(bomb.byteLength).toBeLessThan(5 * 1024 * 1024);
      expect((await parseCriteriaMatrix(bomb, fields, teams)).errors).toEqual([{ code: 'MATRIX_TOO_LARGE' }]);
    });

    it('a matrix sheet stretched past the scan limits', async () => {
      const far = await edit(await buildCriteriaMatrix(fields, teams), (ws) => {
        ws.getCell(MATRIX_LIMITS.MAX_ROWS + 1, 1).value = 'x';
      });
      expect((await parseCriteriaMatrix(far, fields, teams)).errors).toEqual([{ code: 'MATRIX_TOO_LARGE' }]);
    });
  });
});
