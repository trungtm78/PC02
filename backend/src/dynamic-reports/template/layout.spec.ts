import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { extractLayout } from './layout';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/dynamic-reports');

function readFixture(relPath: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES, relPath));
}

function buildWorkbook(
  build: (wb: ExcelJS.Workbook) => void,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  build(wb);
  return wb;
}

/**
 * Layout extraction (spec §4.1 template-parser: "thứ tự sheet, used range,
 * merge, widths/heights, font/fill/border/align/wrap, numFmt, freeze,
 * print area, hidden"). Scope decision for this increment: structural
 * facts only (sheet order, used range, merges, column widths, row
 * heights, freeze panes, print area, visibility) — per-cell visual style
 * (font/border/fill/numFmt) is deliberately NOT pre-extracted into one
 * big JSON here, since the original xlsx bytes are already persisted on
 * `DynReportVersion.fileBytes` and PR4's GridRenderer can re-derive exact
 * per-cell style from those bytes on render, once its real rendering
 * needs are concrete (YAGNI — avoid guessing a shape for a consumer that
 * doesn't exist yet).
 */
describe('extractLayout', () => {
  it('preserves sheet order exactly as selectedSheetNames lists them, not workbook order', () => {
    const wb = buildWorkbook((w) => {
      w.addWorksheet('Z');
      w.addWorksheet('A');
    });
    const layout = extractLayout(wb, ['A', 'Z']);
    expect(layout.sheetOrder).toEqual(['A', 'Z']);
    expect(layout.sheets.map((s) => s.sheetKey)).toEqual(['A', 'Z']);
  });

  it('extracts every merge range on a real multi-merge fixture as plain A1:Z9-style strings', async () => {
    const buffer = readFixture('real/phu_luc_1_6_merges.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheetName = wb.worksheets[0].name;

    const layout = extractLayout(wb, [sheetName]);
    expect(layout.sheets[0].merges).toContain('A1:E1');
    expect(layout.sheets[0].merges.length).toBeGreaterThanOrEqual(28);
  });

  it('captures the used range (top/left/bottom/right) of a real fixture', async () => {
    const buffer = readFixture('real/phu_luc_1_6_merges.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheetName = wb.worksheets[0].name;

    const layout = extractLayout(wb, [sheetName]);
    expect(layout.sheets[0].usedRange).toEqual({
      top: 1,
      left: 1,
      bottom: 28,
      right: 15,
    });
  });

  it('captures explicit column widths and row heights, keyed by number', () => {
    const wb = buildWorkbook((w) => {
      const sheet = w.addWorksheet('Sheet1');
      sheet.getColumn(1).width = 57.875;
      sheet.getRow(1).height = 33;
    });
    const layout = extractLayout(wb, ['Sheet1']);
    expect(layout.sheets[0].columnWidths[1]).toBe(57.875);
    expect(layout.sheets[0].rowHeights[1]).toBe(33);
  });

  it('reports freeze pane split when the sheet view is frozen', () => {
    const wb = buildWorkbook((w) => {
      const sheet = w.addWorksheet('Sheet1');
      sheet.views = [
        { state: 'frozen', xSplit: 2, ySplit: 1, topLeftCell: 'C2' },
      ];
    });
    const layout = extractLayout(wb, ['Sheet1']);
    expect(layout.sheets[0].freeze).toEqual({
      xSplit: 2,
      ySplit: 1,
      topLeftCell: 'C2',
    });
  });

  it('reports freeze as null when the sheet view is not frozen', async () => {
    const buffer = readFixture('real/phu_luc_1_6_merges.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheetName = wb.worksheets[0].name;

    const layout = extractLayout(wb, [sheetName]);
    expect(layout.sheets[0].freeze).toBeNull();
  });

  it('captures a print area when the sheet declares one', () => {
    const wb = buildWorkbook((w) => {
      const sheet = w.addWorksheet('Sheet1');
      sheet.pageSetup.printArea = 'A1:D10';
    });
    const layout = extractLayout(wb, ['Sheet1']);
    expect(layout.sheets[0].printArea).toBe('A1:D10');
  });

  it('reports printArea as null when none is set', () => {
    const wb = buildWorkbook((w) => {
      w.addWorksheet('Sheet1');
    });
    const layout = extractLayout(wb, ['Sheet1']);
    expect(layout.sheets[0].printArea).toBeNull();
  });

  it('captures sheet visibility state (visible/hidden/veryHidden)', () => {
    const wb = buildWorkbook((w) => {
      const sheet = w.addWorksheet('Sheet1');
      sheet.state = 'hidden';
    });
    const layout = extractLayout(wb, ['Sheet1']);
    expect(layout.sheets[0].state).toBe('hidden');
  });

  it('reports a null usedRange and empty merges for a sheet with no content at all', () => {
    const wb = buildWorkbook((w) => {
      w.addWorksheet('Sheet1');
    });
    const layout = extractLayout(wb, ['Sheet1']);
    expect(layout.sheets[0].usedRange).toBeNull();
    expect(layout.sheets[0].merges).toEqual([]);
  });

  it('skips a selected sheet name that does not exist in the workbook, without throwing', () => {
    const wb = buildWorkbook((w) => {
      w.addWorksheet('Sheet1');
    });
    const layout = extractLayout(wb, ['Sheet1', 'NoSuchSheet']);
    expect(layout.sheetOrder).toEqual(['Sheet1', 'NoSuchSheet']);
    expect(layout.sheets).toHaveLength(1);
    expect(layout.sheets[0].sheetKey).toBe('Sheet1');
  });
});
