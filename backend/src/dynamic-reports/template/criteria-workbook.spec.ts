import * as ExcelJS from 'exceljs';
import {
  buildCriteriaWorkbook,
  CRITERIA_LIMITS,
  CRITERIA_SHEET_NAME,
  CriteriaError,
  extractCriteria,
  normaliseCriteria,
} from './criteria-workbook';
import { parseTemplate } from './parser';

async function workbook(build: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  build(wb);
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

/** A sheet the way people really keep a criteria list: a title, a header row, a code column, names, units. */
const realistic = () =>
  workbook((wb) => {
    const s = wb.addWorksheet('Danh mục');
    s.getCell('A1').value = 'DANH MỤC CHỈ TIÊU THỐNG KÊ';
    s.addRow(['STT', 'Chỉ tiêu', 'ĐVT']); // row 2
    s.addRow(['I', 'Tiếp nhận tin báo', '']); // 3
    s.addRow(['1', 'Số tin báo mới', 'tin']); // 4
    s.addRow(['2', 'Số tin báo đã giải quyết', 'tin']); // 5
    s.addRow(['II', 'Điều tra', '']); // 6
    s.addRow(['1', 'Số vụ khởi tố', 'vụ']); // 7
    s.addRow(['', '', '']); // 8 blank
    s.addRow(['2', 'Số bị can', 'người']); // 9
  });

describe('extractCriteria: a column, or some cells of one column, become criteria', () => {
  it('a whole column gives one criterion per non-empty cell, in row order, skipping blanks', async () => {
    const { criteria, warnings } = await extractCriteria(await realistic(), { sheet: 'Danh mục', column: 'B' });

    expect(criteria.map((c) => c.name)).toEqual([
      'Chỉ tiêu',
      'Tiếp nhận tin báo',
      'Số tin báo mới',
      'Số tin báo đã giải quyết',
      'Điều tra',
      'Số vụ khởi tố',
      'Số bị can',
    ]);
    expect(criteria.every((c) => c.origin === 'FILE')).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('picked cells give exactly those rows, whatever order they were picked in', async () => {
    const { criteria } = await extractCriteria(await realistic(), {
      sheet: 'Danh mục',
      column: 'B',
      rows: [7, 4, 5],
    });

    expect(criteria.map((c) => [c.sourceRow, c.name])).toEqual([
      [4, 'Số tin báo mới'],
      [5, 'Số tin báo đã giải quyết'],
      [7, 'Số vụ khởi tố'],
    ]);
  });

  it('a picked cell that is empty is reported, not turned into a nameless criterion', async () => {
    const { criteria, warnings } = await extractCriteria(await realistic(), {
      sheet: 'Danh mục',
      column: 'B',
      rows: [4, 8],
    });

    expect(criteria).toHaveLength(1);
    expect(warnings).toEqual([{ code: 'BLANK_SKIPPED', row: 8 }]);
  });

  it('reads the code and the unit from the columns the author points at', async () => {
    const { criteria } = await extractCriteria(await realistic(), {
      sheet: 'Danh mục',
      column: 'B',
      rows: [4, 9],
      codeColumn: 'A',
      unitColumn: 'C',
    });

    expect(criteria.map((c) => [c.code, c.unit])).toEqual([
      ['1', 'tin'],
      ['2', 'người'],
    ]);
  });

  it('every criterion gets a stable, unique item key even when names or codes repeat', async () => {
    const { criteria, warnings } = await extractCriteria(
      await workbook((wb) => {
        const s = wb.addWorksheet('S');
        s.addRow(['Số vụ']);
        s.addRow(['Số vụ']);
        s.addRow(['Số người']);
      }),
      { sheet: 'S', column: 'A' },
    );

    const keys = criteria.map((c) => c.itemKey);
    expect(new Set(keys).size).toBe(3);
    expect(keys.every((k) => /^[a-z0-9][a-z0-9._-]*$/.test(k))).toBe(true);
    expect(warnings).toEqual([{ code: 'DUPLICATE_NAME', row: 2 }]);
  });

  it('builds the tree from the cell indent: an indented row belongs to the nearest less-indented row above', async () => {
    const buffer = await workbook((wb) => {
      const s = wb.addWorksheet('S');
      s.addRow(['Tiếp nhận']);
      s.addRow(['Tin báo mới']);
      s.addRow(['Tin báo cũ']);
      s.addRow(['Điều tra']);
      s.getCell('A2').alignment = { indent: 1 };
      s.getCell('A3').alignment = { indent: 1 };
    });

    const { criteria } = await extractCriteria(buffer, { sheet: 'S', column: 'A', hierarchy: 'INDENT' });

    const parentOf = Object.fromEntries(criteria.map((c) => [c.name, c.parentItemKey]));
    const key = Object.fromEntries(criteria.map((c) => [c.name, c.itemKey]));
    expect(parentOf).toEqual({
      'Tiếp nhận': null,
      'Tin báo mới': key['Tiếp nhận'],
      'Tin báo cũ': key['Tiếp nhận'],
      'Điều tra': null,
    });
  });

  it('builds the tree from the numbering: I / 1 / 1.1 and 2 / 2.1', async () => {
    const buffer = await workbook((wb) => {
      const s = wb.addWorksheet('S');
      s.addRow(['I', 'Tiếp nhận']);
      s.addRow(['1', 'Tin báo']);
      s.addRow(['1.1', 'Tin báo mới']);
      s.addRow(['1.2', 'Tin báo cũ']);
      s.addRow(['II', 'Điều tra']);
      s.addRow(['1', 'Khởi tố']);
    });

    const { criteria } = await extractCriteria(buffer, {
      sheet: 'S',
      column: 'B',
      codeColumn: 'A',
      hierarchy: 'NUMBERING',
    });

    const byName = Object.fromEntries(criteria.map((c) => [c.name, c]));
    expect(byName['Tiếp nhận'].parentItemKey).toBeNull();
    expect(byName['Tin báo'].parentItemKey).toBe(byName['Tiếp nhận'].itemKey);
    expect(byName['Tin báo mới'].parentItemKey).toBe(byName['Tin báo'].itemKey);
    expect(byName['Tin báo cũ'].parentItemKey).toBe(byName['Tin báo'].itemKey);
    expect(byName['Điều tra'].parentItemKey).toBeNull();
    expect(byName['Khởi tố'].parentItemKey).toBe(byName['Điều tra'].itemKey);
  });

  it('reads what a formula or rich-text cell SHOWS', async () => {
    const buffer = await workbook((wb) => {
      const s = wb.addWorksheet('S');
      s.getCell('A1').value = { formula: '"Số "&"vụ"', result: 'Số vụ' };
      s.getCell('A2').value = { richText: [{ text: 'Số ' }, { text: 'người', font: { bold: true } }] };
    });

    const { criteria } = await extractCriteria(buffer, { sheet: 'S', column: 'A' });

    expect(criteria.map((c) => c.name)).toEqual(['Số vụ', 'Số người']);
  });

  it.each([
    [{ sheet: 'Không có', column: 'A' }, 'CRITERIA_SHEET_NOT_FOUND'],
    [{ sheet: 'Danh mục', column: '1' }, 'CRITERIA_COLUMN_INVALID'],
    [{ sheet: 'Danh mục', column: 'B', rows: [0] }, 'CRITERIA_ROWS_INVALID'],
    [{ sheet: 'Danh mục', column: 'Z' }, 'CRITERIA_EMPTY'],
  ])('refuses %j with %s', async (selection, code) => {
    await expect(extractCriteria(await realistic(), selection)).rejects.toMatchObject({ code });
  });

  it('refuses more criteria than the limit, saying so, instead of cutting the list silently', async () => {
    const buffer = await workbook((wb) => {
      const s = wb.addWorksheet('S');
      for (let i = 0; i <= CRITERIA_LIMITS.MAX_CRITERIA; i += 1) s.addRow([`Chỉ tiêu ${i}`]);
    });
    await expect(extractCriteria(buffer, { sheet: 'S', column: 'A' })).rejects.toMatchObject({
      code: 'CRITERIA_TOO_MANY',
    });
  });
});

describe('normaliseCriteria: the list the author edited in the screen', () => {
  it('keeps a valid list, fills the item key of a hand-typed criterion, and marks where each came from', () => {
    const out = normaliseCriteria([
      { itemKey: 'tin-bao', name: 'Tin báo', origin: 'FILE' },
      { name: '  Chỉ tiêu thêm tay ', unit: 'vụ', parentItemKey: 'tin-bao', origin: 'MANUAL' },
    ]);

    expect(out).toEqual([
      { itemKey: 'tin-bao', code: null, name: 'Tin báo', unit: null, parentItemKey: null, origin: 'FILE', sourceRow: null },
      {
        itemKey: 'chi-tieu-them-tay',
        code: null,
        name: 'Chỉ tiêu thêm tay',
        unit: 'vụ',
        parentItemKey: 'tin-bao',
        origin: 'MANUAL',
        sourceRow: null,
      },
    ]);
  });

  it.each([
    [[], 'CRITERIA_EMPTY'],
    [[{ name: '   ' }], 'CRITERIA_NAME_REQUIRED'],
    [[{ itemKey: 'Có Dấu', name: 'a' }], 'CRITERIA_KEY_INVALID'],
    [[{ itemKey: 'a', name: 'x' }, { itemKey: 'a', name: 'y' }], 'CRITERIA_KEY_DUPLICATE'],
    [[{ itemKey: 'a', name: 'x', parentItemKey: 'ghost' }], 'CRITERIA_PARENT_UNKNOWN'],
    [[{ itemKey: 'a', name: 'x', parentItemKey: 'b' }, { itemKey: 'b', name: 'y', parentItemKey: 'a' }], 'CRITERIA_PARENT_CYCLE'],
    [[{ itemKey: 'a', name: 'x', parentItemKey: 'a' }], 'CRITERIA_PARENT_CYCLE'],
  ])('refuses %j with %s', (input, code) => {
    expect(() => normaliseCriteria(input as never)).toThrow(CriteriaError);
    try {
      normaliseCriteria(input as never);
    } catch (err) {
      expect((err as CriteriaError).code).toBe(code);
    }
  });
});

describe('buildCriteriaWorkbook: the workbook the rest of the system already understands', () => {
  const criteria = normaliseCriteria([
    { itemKey: 'tiep-nhan', code: 'I', name: 'Tiếp nhận tin báo' },
    { itemKey: 'tin-moi', code: '1', name: 'Số tin báo mới', unit: 'tin', parentItemKey: 'tiep-nhan' },
    { itemKey: 'tin-cu', code: '2', name: 'Số tin báo đã giải quyết', unit: 'tin', parentItemKey: 'tiep-nhan' },
    { itemKey: 'khoi-to', name: '=HYPERLINK("http://x","Số vụ khởi tố")', unit: 'vụ', origin: 'MANUAL' },
  ]);

  it('round trip: the existing template parser reads it as one input field per leaf criterion, labelled by its name, with no error', async () => {
    const built = await buildCriteriaWorkbook(criteria);

    const parsed = await parseTemplate(built.buffer, [CRITERIA_SHEET_NAME]);

    expect(parsed.issues.filter((i) => i.severity === 'ERROR')).toEqual([]);
    expect(parsed.fields.map((f) => [f.fieldKey, f.label, f.type, f.aggregate])).toEqual([
      [`${CRITERIA_SHEET_NAME}!C3`, 'Số tin báo mới', 'NUM', 'SUM'],
      [`${CRITERIA_SHEET_NAME}!C4`, 'Số tin báo đã giải quyết', 'NUM', 'SUM'],
      [`${CRITERIA_SHEET_NAME}!C5`, '\'=HYPERLINK("http://x","Số vụ khởi tố")', 'NUM', 'SUM'],
    ]);
  });

  it('tells the caller which cell stands for which criterion, with its unit, parent and origin', async () => {
    const built = await buildCriteriaWorkbook(criteria);

    expect(built.fields).toEqual([
      { address: 'C3', fieldKey: `${CRITERIA_SHEET_NAME}!C3`, itemKey: 'tin-moi', unit: 'tin', parentItemKey: 'tiep-nhan', origin: 'FILE' },
      { address: 'C4', fieldKey: `${CRITERIA_SHEET_NAME}!C4`, itemKey: 'tin-cu', unit: 'tin', parentItemKey: 'tiep-nhan', origin: 'FILE' },
      { address: 'C5', fieldKey: `${CRITERIA_SHEET_NAME}!C5`, itemKey: 'khoi-to', unit: 'vụ', parentItemKey: null, origin: 'MANUAL' },
    ]);
  });

  it('a criterion that has children is not typed: its cell adds its children up', async () => {
    const built = await buildCriteriaWorkbook(criteria);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(built.buffer as never);
    const sheet = wb.getWorksheet(CRITERIA_SHEET_NAME)!;

    expect(sheet.getCell('C2').formula).toBe('SUM(C3,C4)');
    expect(sheet.getCell('C2').protection?.locked ?? true).toBe(true);
    expect(sheet.getCell('C3').protection?.locked).toBe(false);
  });

  it('a name that looks like a formula is written as text, never as a formula', async () => {
    const built = await buildCriteriaWorkbook(criteria);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(built.buffer as never);

    const cell = wb.getWorksheet(CRITERIA_SHEET_NAME)!.getCell('B5');
    expect(cell.formula).toBeUndefined();
    expect(String(cell.value).startsWith("'=")).toBe(true);
  });
});
