import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { buildPeriodWorkbook, PeriodExportTooLargeError, PERIOD_EXPORT_MAX_SHEETS } from './period-export';
import type { PeriodExportRequest, PeriodExportScope } from './period-export';
import { META_SHEET_NAME, readExportMeta } from './template-export';
import type { ExportField } from './template-export';
import { extractGridModel } from '../template/grid-extract';
import { readRawGridInfo } from '../template/grid-raw';
import type { GridModel } from '../engine/grid-types';
import type { FormulaOutcome } from '../engine/grid-workbook';
import { allocateSheetNames, sheetNameKey } from './sheet-names';

/**
 * A manager's file: the report's own sheets, copied once per scope (the totals
 * and each team), each copy filled in. The copies must LOOK like the template —
 * a copy that lost its merged cells or column widths would be a form nobody
 * recognises — and formulas must point at the copy of their own scope.
 */

jest.setTimeout(60_000);
const REAL = path.join(__dirname, '../../../test/fixtures/dynamic-reports/real');

async function gridOf(buffer: Buffer): Promise<GridModel> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const raw = await readRawGridInfo(buffer);
  return extractGridModel(wb, { selectedSheets: wb.worksheets.map((w) => w.name), excludedSheets: [], raw });
}

/** A small two-sheet report: "Nhập" (inputs, merges, widths) and "Tính" (formulas across sheets). */
async function makeTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet('Nhập');
  a.getColumn(1).width = 30;
  a.getColumn(2).width = 14;
  a.getRow(1).height = 28;
  a.mergeCells('A1:C1');
  a.getCell('A1').value = 'BÁO CÁO';
  a.getCell('A1').font = { bold: true, size: 14 };
  a.getCell('A1').alignment = { horizontal: 'center' };
  a.getCell('A2').value = 'Số vụ';
  a.getCell('B2').value = 99; // the sample a template ships
  a.getCell('B2').numFmt = '#,##0';
  a.getCell('A3').value = 'Ngày';
  a.getCell('B3').numFmt = 'dd/mm/yyyy';
  a.getCell('B4').value = { formula: 'B2*2', result: 198 };
  a.getCell('B4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  a.views = [{ state: 'frozen', ySplit: 1 }];
  const b = wb.addWorksheet('Tính');
  b.getCell('A1').value = { formula: "'Nhập'!B2+1", result: 100 };
  b.getCell('A2').value = { formula: 'SUM(Nhập!B2:B3)', result: 99 };
  b.getCell('A3').value = { formula: "IF('Nhập'!B2=0,0,10/'Nhập'!B2)", result: 0.1 };
  b.getCell('A4').value = { formula: 'A1*2', result: 200 };
  const unused = wb.addWorksheet('Không dùng');
  unused.getCell('A1').value = 'x';
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const FIELDS: ExportField[] = [
  { sheetKey: 'Nhập', address: 'B2', fieldKey: 'Nhập!B2', type: 'NUM' },
  { sheetKey: 'Nhập', address: 'B3', fieldKey: 'Nhập!B3', type: 'DATE' },
];

const SHEETS = ['Nhập', 'Tính'];

const TOTAL_OUTCOMES: Record<string, FormulaOutcome> = {
  'Nhập!B4': { ok: true, type: 'number', value: '60' },
  'Tính!A1': { ok: true, type: 'number', value: '31' },
  'Tính!A2': { ok: true, type: 'number', value: '30' },
  'Tính!A3': { ok: false, code: 'DIV_BY_ZERO' },
  'Tính!A4': { ok: false, code: 'MISSING_DATA' },
};

function scopes(): PeriodExportScope[] {
  return [
    { scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: { 'Nhập!B2': '30', 'Nhập!B3': '2026-06-15' } },
    { scope: 't1', label: 'Đội 3', kind: 'TEAM', values: { 'Nhập!B2': '10', 'Nhập!B3': '2026-06-10' } },
    { scope: 't2', label: 'Đội 4', kind: 'TEAM', values: { 'Nhập!B2': '20', 'Nhập!B3': null } },
  ];
}

async function request(over: Partial<PeriodExportRequest> = {}): Promise<{ template: Buffer; req: PeriodExportRequest }> {
  const template = await makeTemplate();
  return {
    template,
    req: {
      selectedSheets: SHEETS,
      fields: FIELDS,
      scopes: scopes(),
      grid: await gridOf(template),
      totalOutcomes: TOTAL_OUTCOMES,
      meta: { kind: 'PERIOD', periodId: 'p1', versionId: 'v1' },
      ...over,
    },
  };
}

async function reload(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return wb;
}

async function cellXml(buffer: Buffer, sheetName: string, address: string): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await (zip.file('xl/workbook.xml') as JSZip.JSZipObject).async('string');
  const rels = await (zip.file('xl/_rels/workbook.xml.rels') as JSZip.JSZipObject).async('string');
  const esc = sheetName.replace(/&/g, '&amp;');
  const sheetTag = (workbookXml.match(/<sheet\b[^>]*>/g) ?? []).find((t) => t.includes(`name="${esc}"`)) as string;
  const rid = /r:id="([^"]+)"/.exec(sheetTag)?.[1] as string;
  const relTag = (rels.match(/<Relationship\b[^>]*>/g) ?? []).find((t) => t.includes(`Id="${rid}"`)) as string;
  const target = /Target="([^"]+)"/.exec(relTag)?.[1] as string;
  const xml = await (zip.file(`xl/${target.replace(/^\//, '').replace(/^xl\//, '')}`) as JSZip.JSZipObject).async('string');
  return new RegExp(`<c r="${address}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`).exec(xml)?.[0] ?? '';
}

describe('buildPeriodWorkbook', () => {
  it('holds one copy of every selected sheet per scope — totals first, then the teams — and nothing else visible', async () => {
    const { template, req } = await request();
    const { buffer } = await buildPeriodWorkbook(template, req);
    const wb = await reload(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'TỔNG - Nhập',
      'TỔNG - Tính',
      'Đội 3 - Nhập',
      'Đội 3 - Tính',
      'Đội 4 - Nhập',
      'Đội 4 - Tính',
      META_SHEET_NAME,
    ]);
    expect(wb.getWorksheet('Không dùng')).toBeUndefined();
    expect(wb.getWorksheet(META_SHEET_NAME)?.state).toBe('veryHidden');
  });

  it('a single-sheet report names the copies after the scopes, as the exports always did', async () => {
    const { template, req } = await request({ selectedSheets: ['Nhập'], fields: FIELDS });
    const { buffer } = await buildPeriodWorkbook(template, req);
    const wb = await reload(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['TỔNG', 'Đội 3', 'Đội 4', META_SHEET_NAME]);
  });

  it('every copy keeps the template\'s look: merges, widths, heights, number formats, fills, freeze', async () => {
    const { template, req } = await request();
    const { buffer } = await buildPeriodWorkbook(template, req);
    const wb = await reload(buffer);
    for (const name of ['TỔNG - Nhập', 'Đội 3 - Nhập', 'Đội 4 - Nhập']) {
      const ws = wb.getWorksheet(name) as ExcelJS.Worksheet;
      expect(ws.model.merges).toEqual(['A1:C1']);
      expect(ws.getColumn(1).width).toBe(30);
      expect(ws.getColumn(2).width).toBe(14);
      expect(ws.getRow(1).height).toBe(28);
      expect(ws.getCell('A1').font?.bold).toBe(true);
      expect(ws.getCell('A1').font?.size).toBe(14);
      expect(ws.getCell('A1').alignment?.horizontal).toBe('center');
      expect(ws.getCell('B2').numFmt).toBe('#,##0');
      expect(ws.getCell('B4').fill).toMatchObject({ pattern: 'solid', fgColor: { argb: 'FFFFFF00' } });
      expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      expect(ws.getCell('A2').value).toBe('Số vụ'); // static text travels with the copy
    }
  });

  it('writes each scope\'s own numbers into its own copy, never the template\'s sample', async () => {
    const { template, req } = await request();
    const { buffer } = await buildPeriodWorkbook(template, req);
    const wb = await reload(buffer);
    expect(wb.getWorksheet('TỔNG - Nhập')?.getCell('B2').value).toBe(30);
    expect(wb.getWorksheet('Đội 3 - Nhập')?.getCell('B2').value).toBe(10);
    expect(wb.getWorksheet('Đội 4 - Nhập')?.getCell('B2').value).toBe(20);
    const d = wb.getWorksheet('Đội 3 - Nhập')?.getCell('B3').value as Date;
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-10');
    expect(wb.getWorksheet('Đội 4 - Nhập')?.getCell('B3').value).toBeNull(); // blank stays blank
  });

  describe('the totals (OV5): official figures as constants, never formulas Excel could recalculate', () => {
    it('every formula cell of a totals copy is a plain value — the figure the system reported', async () => {
      const { template, req } = await request();
      const { buffer } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      const nhap = wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet;
      const tinh = wb.getWorksheet('TỔNG - Tính') as ExcelJS.Worksheet;
      expect(nhap.getCell('B4').value).toBe(60);
      expect(tinh.getCell('A1').value).toBe(31);
      expect(tinh.getCell('A2').value).toBe(30);
      expect(tinh.getCell('A3').value).toEqual({ error: '#DIV/0!' });
      // A missing contribution is said in words, not a 0 an addition would have turned it into.
      expect(tinh.getCell('A4').value).toBe('Thiếu dữ liệu');
      for (const ws of [nhap, tinh]) {
        ws.eachRow((row) =>
          row.eachCell((cell) => {
            const v = cell.value as { formula?: string; sharedFormula?: string } | null;
            expect(v && typeof v === 'object' ? (v.formula ?? v.sharedFormula) : undefined).toBeUndefined();
          }),
        );
      }
    });

    it('a formula the system did not work out is blanked, not left to Excel, and is listed in the metadata', async () => {
      const { template, req } = await request({
        totalOutcomes: { 'Tính!A1': { ok: true, type: 'number', value: '31' } },
      });
      const { buffer, outcome } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      expect(wb.getWorksheet('TỔNG - Tính')?.getCell('A2').value).toBeNull();
      expect(outcome.unresolvedTotals).toEqual(expect.arrayContaining(['Nhập!B4', 'Tính!A2', 'Tính!A3', 'Tính!A4']));
      const meta = readExportMeta(wb) as Record<string, string>;
      expect(Object.values(meta)).toContain('Tính!A2');
    });

    it('no figures at all from the system: every formula of the totals is blank, not recalculated', async () => {
      const { template, req } = await request({ totalOutcomes: null });
      const { buffer } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      expect(wb.getWorksheet('TỔNG - Tính')?.getCell('A1').value).toBeNull();
      expect(wb.getWorksheet('TỔNG - Nhập')?.getCell('B4').value).toBeNull();
    });

    it('a figure Excel cannot hold exactly is written as text, like everywhere else', async () => {
      const { template, req } = await request();
      req.scopes[0].values['Nhập!B2'] = '900719925474099301';
      const { buffer, outcome } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      expect(wb.getWorksheet('TỔNG - Nhập')?.getCell('B2').value).toBe('900719925474099301');
      expect(outcome.textNumbers).toContain('TOTAL:Nhập!B2');
    });
  });

  describe('a team copy keeps its formulas, pointed at its own copy', () => {
    it('a formula that names another sheet names the copy in the same scope', async () => {
      const { template, req } = await request();
      const { buffer } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      const f = (sheet: string, addr: string) =>
        (wb.getWorksheet(sheet)?.getCell(addr).value as { formula: string }).formula;
      expect(f('Đội 3 - Tính', 'A1')).toBe("'Đội 3 - Nhập'!B2+1");
      expect(f('Đội 4 - Tính', 'A1')).toBe("'Đội 4 - Nhập'!B2+1");
      expect(f('Đội 3 - Tính', 'A2')).toBe("SUM('Đội 3 - Nhập'!B2:B3)");
      expect(f('Đội 3 - Tính', 'A3')).toBe("IF('Đội 3 - Nhập'!B2=0,0,10/'Đội 3 - Nhập'!B2)");
    });

    it('a formula that names no sheet is left exactly as it was (it means "this sheet")', async () => {
      const { template, req } = await request();
      const { buffer } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      expect((wb.getWorksheet('Đội 4 - Tính')?.getCell('A4').value as { formula: string }).formula).toBe('A1*2');
      expect((wb.getWorksheet('Đội 4 - Nhập')?.getCell('B4').value as { formula: string }).formula).toBe('B2*2');
    });

    it('carries the figure worked out from THAT team\'s numbers as the cached result', async () => {
      const { template, req } = await request();
      const { buffer } = await buildPeriodWorkbook(template, req);
      // Team 1 typed 10: B4 = B2*2 = 20 and Tính!A1 = 11; team 2 typed 20: 40 and 21.
      expect(await cellXml(buffer, 'Đội 3 - Nhập', 'B4')).toMatch(/<v>20<\/v>/);
      expect(await cellXml(buffer, 'Đội 4 - Nhập', 'B4')).toMatch(/<v>40<\/v>/);
      expect(await cellXml(buffer, 'Đội 3 - Tính', 'A1')).toMatch(/<v>11<\/v>/);
      expect(await cellXml(buffer, 'Đội 4 - Tính', 'A1')).toMatch(/<v>21<\/v>/);
    });

    it('asks the viewer to recalculate when the file is opened', async () => {
      const { template, req } = await request();
      const { buffer } = await buildPeriodWorkbook(template, req);
      const zip = await JSZip.loadAsync(buffer);
      const xml = await (zip.file('xl/workbook.xml') as JSZip.JSZipObject).async('string');
      expect(xml).toMatch(/fullCalcOnLoad="1"/);
    });
  });

  describe('the hidden metadata sheet', () => {
    it('says it is a period file, so the import (S35) can refuse it, and carries the name table', async () => {
      const { template, req } = await request();
      const { buffer, names } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      const meta = readExportMeta(wb) as Record<string, string>;
      expect(meta.kind).toBe('PERIOD');
      expect(meta.periodId).toBe('p1');
      // (scope, original sheet) → exported name, so a reader can find any copy.
      expect(meta[`sheet|t1|Nhập`]).toBe('Đội 3 - Nhập');
      expect(meta[`sheet|TOTAL|Tính`]).toBe('TỔNG - Tính');
      expect(names.get(sheetNameKey('t2', 'Tính'))).toBe('Đội 4 - Tính');
    });

    it('lists the sheets in the same table the names were allocated from', async () => {
      const { template, req } = await request();
      const { names } = await buildPeriodWorkbook(template, req);
      expect([...names.entries()]).toEqual(
        [...allocateSheetNames(req.scopes, SHEETS).entries()],
      );
    });
  });

  it('a template with a picture only on a dropped sheet leaves no picture behind', async () => {
    const pl7 = fs.readFileSync(path.join(REAL, 'hsln_17_sheets.xlsx'));
    const raw = await readRawGridInfo(pl7);
    const wbx = await reload(pl7);
    const model = extractGridModel(wbx, { selectedSheets: ['Đội 3'], excludedSheets: [], raw });
    const { buffer } = await buildPeriodWorkbook(pl7, {
      selectedSheets: ['Đội 3'],
      fields: [{ sheetKey: 'Đội 3', address: 'C6', fieldKey: 'Đội 3!C6', type: 'NUM' }],
      scopes: [
        { scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: { 'Đội 3!C6': '5' } },
        { scope: 't1', label: 'Tổ 1', kind: 'TEAM', values: { 'Đội 3!C6': '2' } },
      ],
      grid: model,
      totalOutcomes: {},
      meta: { kind: 'PERIOD' },
    });
    const wb = await reload(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['TỔNG', 'Tổ 1', META_SHEET_NAME]);
    // Both copies come from the same original: the same merges and widths.
    const a = wb.getWorksheet('TỔNG') as ExcelJS.Worksheet;
    const b = wb.getWorksheet('Tổ 1') as ExcelJS.Worksheet;
    expect(a.model.merges).toEqual(b.model.merges);
    expect(a.getColumn(2).width).toBe(b.getColumn(2).width);
    expect(a.getCell('C6').value).toBe(5);
    expect(b.getCell('C6').value).toBe(2);
  });

  it('refuses a request too large for one file instead of running the worker out of memory', async () => {
    const { template, req } = await request();
    const many: PeriodExportScope[] = Array.from({ length: 5000 }, (_, i) => ({
      scope: `t${i}`,
      label: `Tổ ${i}`,
      kind: 'TEAM' as const,
      values: {},
    }));
    expect(many.length * SHEETS.length).toBeGreaterThan(PERIOD_EXPORT_MAX_SHEETS);
    await expect(buildPeriodWorkbook(template, { ...req, scopes: many })).rejects.toBeInstanceOf(
      PeriodExportTooLargeError,
    );
  });
});

/**
 * Fidelity against the REAL templates, read back through the grid extractor (an
 * independent reading of the .xlsx): every copy, totals or team, has the same
 * merges, sizes, hidden lines, frozen panes and — cell by cell — the same look
 * as the sheet it was copied from.
 */
describe('buildPeriodWorkbook — every copy of a real template looks like the template', () => {
  const TEMPLATES: Array<[string, string[]]> = [
    ['pl7', ['Thống kê sl vụ việc']],
    ['a09_1034_unlocked', ['A09']],
    ['a10_99_formulas', ['A10']],
    ['bao_cao_ngay_shared_formulas', ['Sheet1']],
    ['phu_luc_07_08_multi_sheet', ['Thống kê sl vụ việc', 'Thống kê sl vụ án']],
    ['phu_luc_1_6_merges', ['DS hồ sơ VV hiện hành (trừ TĐC)', 'DS vv TĐC hết thời hiệu', 'DS vv TĐC còn thời hiệu']],
  ];

  /**
   * A style as the eye sees it. exceljs rewrites the workbook's default font (a template whose "Normal" font is
   * Times New Roman comes back as Calibri) and writes the name into every cell that relied on it, so a cell
   * with no explicit font is compared by the font it actually shows.
   */
  const effective = (model: GridModel, index: number) => {
    const style = model.styles[index] ?? {};
    return {
      ...style,
      fontName: style.fontName ?? model.defaultFont.name,
      fontSizePt: style.fontSizePt ?? model.defaultFont.sizePt,
    };
  };

  it.each(TEMPLATES)('%s', async (stem, selected) => {
    const template = fs.readFileSync(path.join(REAL, `${stem}.xlsx`));
    const wbT = await reload(template);
    const rawT = await readRawGridInfo(template);
    const original = extractGridModel(wbT, { selectedSheets: selected, excludedSheets: [], raw: rawT });

    const scopeList: PeriodExportScope[] = [
      { scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: {} },
      { scope: 't1', label: 'Tổ A', kind: 'TEAM', values: {} },
    ];
    const { buffer, names } = await buildPeriodWorkbook(template, {
      selectedSheets: selected,
      fields: [],
      scopes: scopeList,
      grid: original,
      totalOutcomes: {},
      meta: { kind: 'PERIOD' },
    });

    const wbE = await reload(buffer);
    const rawE = await readRawGridInfo(buffer);
    const exportedNames = scopeList.flatMap((sc) => selected.map((o) => names.get(sheetNameKey(sc.scope, o)) as string));
    const exported = extractGridModel(wbE, { selectedSheets: exportedNames, excludedSheets: [], raw: rawE });

    for (const sc of scopeList) {
      for (const orig of selected) {
        const a = original.sheets.find((x) => x.name === orig) as GridModel['sheets'][number];
        const b = exported.sheets.find((x) => x.name === names.get(sheetNameKey(sc.scope, orig))) as GridModel['sheets'][number];
        expect(b).toBeDefined();
        const byPosition = (m: GridModel['sheets'][number]['merges']) =>
          [...m].sort((x, y) => x.top - y.top || x.left - y.left || x.bottom - y.bottom || x.right - y.right);
        expect(byPosition(b.merges)).toEqual(byPosition(a.merges)); // the order of the list means nothing
        expect(b.colWidthsPx).toEqual(a.colWidthsPx);
        expect(b.rowHeightsPx).toEqual(a.rowHeightsPx);
        expect(b.hiddenRows).toEqual(a.hiddenRows);
        expect(b.hiddenCols).toEqual(a.hiddenCols);
        expect(b.freeze).toEqual(a.freeze);
        expect(b.zoom).toEqual(a.zoom);
        expect(b.showGridlines).toBe(a.showGridlines);
        expect(b.conditionalFormats.length).toBe(a.conditionalFormats.length);
        for (const [address, cell] of Object.entries(a.cells)) {
          const other = b.cells[address];
          expect(other).toBeDefined();
          expect(effective(exported, other.s)).toEqual(effective(original, cell.s));
        }
      }
    }
  });
});
