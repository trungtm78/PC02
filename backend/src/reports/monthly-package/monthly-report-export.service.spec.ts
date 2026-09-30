/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { MonthlyReportExportService } from './monthly-report-export.service';
import type { MonthlyReportSnapshot } from './monthly-report.rules';

jest.setTimeout(20_000);

function formulaCells(sheet: ExcelJS.Worksheet) {
  const cells: string[] = [];
  sheet.eachRow((row) =>
    row.eachCell((cell) => {
      if (
        cell.value &&
        typeof cell.value === 'object' &&
        'formula' in cell.value
      )
        cells.push(cell.address);
    }),
  );
  return cells;
}

const snapshot: MonthlyReportSnapshot = {
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  unitName: 'PC02',
  templateVersion: '2026.09',
  appendices: Array.from({ length: 8 }, (_, index) => ({
    code: `PL0${index + 1}` as MonthlyReportSnapshot['appendices'][number]['code'],
    kind: index < 6 ? 'DETAIL' : 'SUMMARY',
    rows:
      index === 0
        ? [
            {
              recordId: 'i-1',
              recordCode: '26-1',
              cells: { crime: 'Trộm cắp', receivedDate: '01/09/2026' },
            },
          ]
        : [],
    metrics:
      index === 6 ? [{ key: '1', value: 1, contributionIds: ['ct-1'] }] : [],
  })),
};

describe('MonthlyReportExportService', () => {
  const service = new MonthlyReportExportService();

  it('renders exactly six official sheets from the 1-6 template', async () => {
    const output = await service.render('DETAIL', snapshot);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(output as any);
    const template = new ExcelJS.Workbook();
    await template.xlsx.readFile(service.templatePath('DETAIL'));

    expect(workbook.worksheets).toHaveLength(6);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'DS hồ sơ VV hiện hành (trừ TĐC)',
      'DS vv TĐC hết thời hiệu',
      'DS vv TĐC còn thời hiệu',
      'DS hồ sơ VA hiện hành (trừ TĐC)',
      'DS vụ án TĐC hết thời hiệu',
      'DS vụ án TĐC còn thời hiệu',
    ]);
    expect(workbook.worksheets[0].getCell('A6').value).toBe(1);
    expect(workbook.worksheets[0].getCell('B6').value).toBe('Trộm cắp');
    workbook.worksheets.forEach((sheet, index) => {
      expect(sheet.pageSetup.printArea).toBe(
        template.worksheets[index].pageSetup.printArea,
      );
      expect([...sheet.model.merges].sort()).toEqual(
        [...template.worksheets[index].model.merges].sort(),
      );
      expect(formulaCells(sheet)).toEqual(
        formulaCells(template.worksheets[index]),
      );
    });
  });

  it('renders exactly two official sheets and keeps formula cells in the 07-08 template', async () => {
    const output = await service.render('SUMMARY', snapshot);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(output as any);
    const template = new ExcelJS.Workbook();
    await template.xlsx.readFile(service.templatePath('SUMMARY'));

    expect(workbook.worksheets).toHaveLength(2);
    expect(workbook.worksheets[0].getCell('D5').value).toBe(1);
    expect(workbook.worksheets[0].getCell('G9').value).toEqual(
      expect.objectContaining({ formula: expect.any(String) }),
    );
    workbook.worksheets.forEach((sheet, index) => {
      expect(sheet.pageSetup.printArea).toBe(
        template.worksheets[index].pageSetup.printArea,
      );
      expect([...sheet.model.merges].sort()).toEqual(
        [...template.worksheets[index].model.merges].sort(),
      );
      expect(formulaCells(sheet)).toEqual(
        formulaCells(template.worksheets[index]),
      );
    });
  });

  it('resolves versioned templates from packaged application assets', () => {
    expect(service.templatePath('DETAIL')).toContain(
      path.join('templates', 'xlsx', 'monthly-reports', '2026.09'),
    );
  });

  it(
    'moves merged signature blocks when detail data exceeds the three template rows',
    async () => {
      const large = structuredClone(snapshot);
      large.appendices[0].rows = Array.from({ length: 10 }, (_, index) => ({
        recordId: `i-${index}`,
        cells: { crime: `Tội ${index}` },
      }));
      const output = await service.render('DETAIL', large);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(output as any);
      const sheet = workbook.worksheets[0];
      expect(sheet.getCell('A18').value).toBe('CÁN BỘ THỐNG KÊ');
      expect(sheet.model.merges).toContain('A18:H18');
      expect(sheet.getCell('A11').value).not.toBe('CÁN BỘ THỐNG KÊ');
    },
    60_000,
  );
});
