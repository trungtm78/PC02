import * as ExcelJS from 'exceljs';
import { BcaExcelHelper } from './bca-excel.helper';

describe('BCA export footer for narrow column selections', () => {
  it.each([1, 2, 3])(
    'writes and reopens a %i-column workbook with both signature blocks and intact data',
    async (columns) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Export');
      sheet.getCell('A1').value = 'Authorized data';
      BcaExcelHelper.addFooter(sheet, 10, columns);
      const restored = new ExcelJS.Workbook();
      await restored.xlsx.load(await workbook.xlsx.writeBuffer());
      const output = restored.worksheets[0];
      expect(output.getCell('A1').value).toBe('Authorized data');
      expect(output.columnCount).toBe(columns);
      const values = JSON.stringify(output.getSheetValues());
      expect(values).toContain('NGƯỜI LẬP BẢNG');
      expect(values).toContain('THỦ TRƯỞNG ĐƠN VỊ');
      if (columns === 1) {
        expect(output.getCell('A11').value).toBe('NGƯỜI LẬP BẢNG');
        expect(output.getCell('A17').value).toBe('THỦ TRƯỞNG ĐƠN VỊ');
      } else {
        expect(output.getCell('A11').value).toBe('NGƯỜI LẬP BẢNG');
        expect(output.getCell('B11').value).toBe('THỦ TRƯỞNG ĐƠN VỊ');
      }
    },
  );
  it('preserves normal wide signature layout, font, alignment and signing space', () => {
    const sheet = new ExcelJS.Workbook().addWorksheet('Export');
    BcaExcelHelper.addFooter(sheet, 10, 6);
    expect(sheet.getCell('A11').value).toBe('NGƯỜI LẬP BẢNG');
    expect(sheet.getCell('E11').value).toBe('THỦ TRƯỞNG ĐƠN VỊ');
    expect(sheet.getCell('C11').isMerged).toBe(true);
    expect(sheet.getCell('F11').isMerged).toBe(true);
    expect(sheet.getCell('A11').font).toMatchObject({
      bold: true,
      size: 11,
      name: 'Times New Roman',
    });
    expect(sheet.getCell('E11').alignment).toMatchObject({
      horizontal: 'center',
      vertical: 'middle',
    });
    expect(sheet.getRow(13).height).toBe(18);
    expect(sheet.getRow(14).height).toBe(18);
  });
});
