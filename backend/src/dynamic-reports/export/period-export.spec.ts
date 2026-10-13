import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  buildPeriodWorkbook,
  PeriodExportTooLargeError,
  PeriodExportUnsupportedError,
  PERIOD_EXPORT_MAX_SHEETS,
} from './period-export';
import type { PeriodExportRequest, PeriodExportScope } from './period-export';
import { META_SHEET_NAME, readExportMeta } from './template-export';
import type { ExportField } from './template-export';
import { extractGridModel } from '../template/grid-extract';
import { readRawGridInfo } from '../template/grid-raw';
import type { GridModel } from '../engine/grid-types';
import type { FormulaOutcome } from '../engine/grid-workbook';
import { allocateSheetNames, sheetNameKey } from './sheet-names';
import { evaluateFormula } from '../engine/expr';
import type { CellResolution } from '../engine/expr';

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

  /** The cell as Excel would read it back: a formula is its cached result. */
  function resolverOf(wb: ExcelJS.Workbook) {
    return {
      resolveCell: (ref: { sheet?: string; cell: string }): CellResolution => {
        const ws = wb.getWorksheet(ref.sheet ?? '');
        if (!ws) return { kind: 'not_found' };
        let v = ws.getCell(ref.cell).value as unknown;
        if (v && typeof v === 'object' && 'formula' in (v as object)) v = (v as { result?: unknown }).result;
        if (v === null || v === undefined || v === '') return { kind: 'blank' };
        if (typeof v === 'number') return { kind: 'value', value: v };
        return { kind: 'text', value: String(v) };
      },
      expandRange: () => [],
      prevValue: () => ({ kind: 'none' as const }),
    };
  }

  /** The formula of a cell worked out again by the expression engine over the workbook's own cells. */
  function recalculate(wb: ExcelJS.Workbook, sheet: string, address: string): string | number | null {
    const cell = (wb.getWorksheet(sheet) as ExcelJS.Worksheet).getCell(address).value as { formula: string };
    const r = evaluateFormula(cell.formula, resolverOf(wb));
    if (!r.ok) throw new Error(`${cell.formula} -> ${r.error.code}`);
    if (r.value.type === 'string') return r.value.value === '' ? null : r.value.value;
    return r.value.type === 'number' ? r.value.value.toNumber() : null;
  }

  const SUM_FIELDS = [
    { sheetKey: 'Nhập', address: 'B2', fieldKey: 'Nhập!B2', type: 'NUM' as const, aggregate: 'SUM' as const, blankPolicy: 'ZERO' as const },
    { sheetKey: 'Nhập', address: 'B3', fieldKey: 'Nhập!B3', type: 'DATE' as const, aggregate: 'NONE' as const, blankPolicy: 'ZERO' as const },
  ];

  describe('the totals input cells are formulas over the sheets of the teams that count', () => {
    const teamsScopes = (counted: [boolean, boolean]): PeriodExportScope[] => [
      { scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: { 'Nhập!B2': '10', 'Nhập!B3': null } },
      { scope: 't1', label: 'Đội 3', kind: 'TEAM', counted: counted[0], values: { 'Nhập!B2': '10', 'Nhập!B3': null } },
      { scope: 't2', label: 'Đội 4', kind: 'TEAM', counted: counted[1], values: { 'Nhập!B2': '20', 'Nhập!B3': null } },
    ];

    it('adds up the approved teams sheets only, carries the systems figure as the cached result, and leaves the unapproved team out', async () => {
      const { template, req } = await request({ fields: SUM_FIELDS, scopes: teamsScopes([true, false]) });
      const { buffer, outcome } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      const total = (wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet).getCell('B2').value;
      expect(total).toEqual({ formula: "SUM('Đội 3 - Nhập'!B2)", result: 10 });
      expect(outcome.constantTotals).toEqual([]);
      // a field that is not totalled (DATE / NONE) stays what it was
      expect((wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet).getCell('B3').value).toBeNull();
    });

    it('the formula really recalculates: worked out again from the sheets it names it gives the systems figure, and follows an edit of a teams number', async () => {
      const { template, req } = await request({
        fields: SUM_FIELDS,
        scopes: [
          { scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: { 'Nhập!B2': '30', 'Nhập!B3': null } },
          ...teamsScopes([true, true]).slice(1),
        ],
      });
      const wb = await reload((await buildPeriodWorkbook(template, req)).buffer);
      expect(recalculate(wb, 'TỔNG - Nhập', 'B2')).toBe(30); // = the cached result = the systems figure

      (wb.getWorksheet('Đội 4 - Nhập') as ExcelJS.Worksheet).getCell('B2').value = 25; // someone corrects a teams sheet
      expect(recalculate(wb, 'TỔNG - Nhập', 'B2')).toBe(35);
    });

    it('with the IGNORE policy a blank team is left out of an average, and all-blank gives an empty text like the systems dash', async () => {
      const avg = [{ ...SUM_FIELDS[0], aggregate: 'AVG' as const, blankPolicy: 'IGNORE' as const }];
      const { template, req } = await request({
        fields: avg,
        scopes: [
          { scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: { 'Nhập!B2': '10' } },
          { scope: 't1', label: 'Đội 3', kind: 'TEAM', counted: true, values: { 'Nhập!B2': '10' } },
          { scope: 't2', label: 'Đội 4', kind: 'TEAM', counted: true, values: { 'Nhập!B2': null } },
        ],
      });
      const wb = await reload((await buildPeriodWorkbook(template, req)).buffer);
      expect((wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet).getCell('B2').value).toMatchObject({
        formula: expect.stringContaining('AVERAGE('),
        result: 10,
      });
      expect(recalculate(wb, 'TỔNG - Nhập', 'B2')).toBe(10);
      (wb.getWorksheet('Đội 3 - Nhập') as ExcelJS.Worksheet).getCell('B2').value = null;
      expect(recalculate(wb, 'TỔNG - Nhập', 'B2')).toBeNull(); // every cell blank
    });

    it('no team counted (nobody approved): the cell keeps the plain figure, and the metadata says why', async () => {
      const { template, req } = await request({ fields: SUM_FIELDS, scopes: teamsScopes([false, false]) });
      const { buffer, outcome } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      expect((wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet).getCell('B2').value).toBe(10); // the figure written as before
      expect(outcome.constantTotals).toEqual(['Nhập!B2: no team is approved']);
      expect(Object.values(readExportMeta(wb) as Record<string, string>)).toContain('Nhập!B2: no team is approved');
    });

    it('a figure Excel cannot hold exactly stays number-as-text and the cell keeps it: a formula over it would round it', async () => {
      const big = '12345678901234567890';
      const { template, req } = await request({
        fields: SUM_FIELDS,
        scopes: [
          { scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: { 'Nhập!B2': big } },
          { scope: 't1', label: 'Đội 3', kind: 'TEAM', counted: true, values: { 'Nhập!B2': big } },
        ],
      });
      const { buffer, outcome } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      expect((wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet).getCell('B2').value).toBe(big);
      expect(outcome.constantTotals[0]).toContain('more digits than Excel holds');
    });

    it('COUNT with the ZERO policy is the number of teams, a plain number', async () => {
      const count = [{ ...SUM_FIELDS[0], aggregate: 'COUNT' as const }];
      const { template, req } = await request({
        fields: count,
        scopes: [
          { scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: { 'Nhập!B2': '2' } },
          ...teamsScopes([true, true]).slice(1),
        ],
      });
      const { buffer, outcome } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      expect((wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet).getCell('B2').value).toBe(2);
      expect(outcome.constantTotals).toEqual(['Nhập!B2: COUNT counts the teams: a number']);
    });
  });

  it('a shared formula whose first cell the system could not work out does not break the file: its followers are written out in full (found by Codex)', async () => {
    const wbSrc = new ExcelJS.Workbook();
    const sheet = wbSrc.addWorksheet('Nhập');
    sheet.getCell('B2').value = 1;
    sheet.getCell('B3').value = 2;
    sheet.getCell('C2').value = { formula: 'B2*2', shareType: 'shared', ref: 'C2:C3', result: 2 } as ExcelJS.CellValue;
    sheet.getCell('C3').value = { sharedFormula: 'C2', result: 4 } as ExcelJS.CellValue;
    const template = Buffer.from(await wbSrc.xlsx.writeBuffer());
    const fields: PeriodExportRequest['fields'] = [
      { sheetKey: 'Nhập', address: 'B2', fieldKey: 'Nhập!B2', type: 'NUM' },
      { sheetKey: 'Nhập', address: 'B3', fieldKey: 'Nhập!B3', type: 'NUM' },
    ];
    const req: PeriodExportRequest = {
      selectedSheets: ['Nhập'],
      fields,
      scopes: [{ scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: { 'Nhập!B2': null, 'Nhập!B3': '2' } }],
      grid: await gridOf(template),
      totalOutcomes: { 'Nhập!C2': { ok: false, code: 'MISSING_DATA' }, 'Nhập!C3': { ok: true, type: 'number', value: '4' } },
      meta: { kind: 'PERIOD' },
    };

    const wb = await reload((await buildPeriodWorkbook(template, req)).buffer); // used to throw: follower without its master
    const totals = wb.getWorksheet('TỔNG') as ExcelJS.Worksheet;
    expect(totals.getCell('C2').value).toBe('Thiếu dữ liệu');
    expect(totals.getCell('C3').value).toEqual({ formula: 'B3*2', result: 4 }); // its own formula, not the first cell's
  });

  it('when a totals figure had to be written as text (more digits than Excel holds) no template formula on the totals stays a formula that would read it as text (found by Codex)', async () => {
    const { template, req } = await request({
      scopes: [
        { scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: { 'Nhập!B2': '12345678901234567', 'Nhập!B3': null } },
        { scope: 't1', label: 'Đội 3', kind: 'TEAM', counted: true, values: { 'Nhập!B2': '5', 'Nhập!B3': null } },
      ],
    });
    const wb = await reload((await buildPeriodWorkbook(template, req)).buffer);
    const totals = wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet;
    expect(totals.getCell('B2').value).toBe('12345678901234567');
    expect(totals.getCell('B4').value).toBe(60); // the figure the system reported, as a plain value: not a formula over the text
  });

  it('the totals carry a line saying which teams they are made of; the team sheets do not (production 13/10: a blank TỔNG nobody could explain)', async () => {
    const note = 'Số liệu tổng hợp từ 1/3 tổ đã duyệt. Chưa tính: Đội 4 (đã nộp, chưa duyệt).';
    const { template, req } = await request({ totalsNote: note });
    const { buffer } = await buildPeriodWorkbook(template, req);
    const wb = await reload(buffer);

    const totals = wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet;
    let lastWithValue = 0;
    totals.eachRow({ includeEmpty: false }, (row, n) => {
      if (row.hasValues && row.getCell(1).value !== note) lastWithValue = n;
    });
    expect(totals.getCell(lastWithValue + 2, 1).value).toBe(note); // two rows under the template's own last row
    expect(totals.getCell('B2').value).toBe(30); // the figures are where they were
    for (const name of ['TỔNG - Tính', 'Đội 3 - Nhập', 'Đội 4 - Nhập']) {
      const ws = wb.getWorksheet(name) as ExcelJS.Worksheet;
      let found = false;
      ws.eachRow({ includeEmpty: false }, (row) => row.eachCell((c) => { if (c.value === note) found = true; }));
      expect(found).toBe(false);
    }
  });

  it('a print area that stops above the note is extended to include it, and the note is merged across the table so it is not cut off (found by Codex)', async () => {
    const note = 'Số liệu tổng hợp từ 1/3 tổ đã duyệt. Chưa tính: Đội 4 (đã nộp, chưa duyệt); Đội 5 (chưa nhập).';
    const template = await makeTemplate();
    const withArea = new ExcelJS.Workbook();
    await withArea.xlsx.load(template as unknown as ExcelJS.Buffer);
    (withArea.getWorksheet('Nhập') as ExcelJS.Worksheet).pageSetup.printArea = 'A1:C4';
    const patched = Buffer.from(await withArea.xlsx.writeBuffer());
    const { req } = await request({ totalsNote: note, grid: await gridOf(patched) });

    const wb = await reload((await buildPeriodWorkbook(patched, req)).buffer);
    const totals = wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet;
    expect(totals.pageSetup.printArea).toBe('A1:C6'); // the note is on row 6: last used row 4, plus two
    expect(totals.getCell('A6').value).toBe(note);
    expect(totals.model.merges).toContain('A6:C6');
    expect(totals.getCell('A6').alignment?.wrapText).toBe(true);
  });

  it('no note, no extra row', async () => {
    const { template, req } = await request();
    const { buffer } = await buildPeriodWorkbook(template, req);
    const wb = await reload(buffer);
    const baseline = (wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet).rowCount;
    const { template: t2, req: r2 } = await request({ totalsNote: '' });
    const again = await reload((await buildPeriodWorkbook(t2, r2)).buffer);
    expect((again.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet).rowCount).toBe(baseline);
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

  describe("the totals: the template's formulas stay formulas, carrying the figure the system reported (OV5)", () => {
    it('a formula the system worked out stays a formula (pointed at the totals own cells) with that figure as its result; one it could not is said in words, never a 0', async () => {
      const { template, req } = await request();
      const { buffer } = await buildPeriodWorkbook(template, req);
      const wb = await reload(buffer);
      const nhap = wb.getWorksheet('TỔNG - Nhập') as ExcelJS.Worksheet;
      const tinh = wb.getWorksheet('TỔNG - Tính') as ExcelJS.Worksheet;
      expect(nhap.getCell('B4').value).toEqual({ formula: 'B2*2', result: 60 });
      // Cross-sheet references are re-pointed at the TOTALS copy of the sheet, not at a team's.
      expect(tinh.getCell('A1').value).toEqual({ formula: "'TỔNG - Nhập'!B2+1", result: 31 });
      expect(tinh.getCell('A2').value).toEqual({ formula: "SUM('TỔNG - Nhập'!B2:B3)", result: 30 });
      // What the system could not work out is a plain value: Excel would have made "missing" a 0.
      expect(tinh.getCell('A3').value).toEqual({ error: '#DIV/0!' });
      expect(tinh.getCell('A4').value).toBe('Thiếu dữ liệu');
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

/**
 * Found by review (Codex, G5b), each reproduced: places where a copy could quietly read or show somebody
 * else's number, or the build could fail on an ordinary template.
 */
describe('buildPeriodWorkbook — templates that are not tidy', () => {
  async function build(
    make: (wb: ExcelJS.Workbook) => void,
    selected: string[],
    fields: ExportField[],
    teamLabel = 'Beta',
    totalOutcomes: Record<string, FormulaOutcome> | null = {},
  ) {
    const wb = new ExcelJS.Workbook();
    make(wb);
    const template = Buffer.from(await wb.xlsx.writeBuffer());
    const grid = await gridOf(template);
    const req: PeriodExportRequest = {
      selectedSheets: selected,
      fields,
      scopes: [
        { scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: {} },
        { scope: 't1', label: teamLabel, kind: 'TEAM', values: {} },
      ],
      grid,
      totalOutcomes,
      meta: { kind: 'PERIOD' },
    };
    const built = await buildPeriodWorkbook(template, req);
    return { ...built, wb: await reload(built.buffer) };
  }

  const formulaOf = (wb: ExcelJS.Workbook, sheet: string, addr: string) =>
    (wb.getWorksheet(sheet)?.getCell(addr).value as { formula?: string } | null)?.formula;

  it('a reference to a sheet that is not in the report cannot land on a copy that happens to carry its name', async () => {
    // "Alpha" is dropped (not selected) — and a team is called "Alpha", so a sheet named "Alpha" exists in the file.
    const { wb, outcome } = await build(
      (b) => {
        b.addWorksheet('Input').getCell('B1').value = { formula: 'Alpha!A1+1', result: 2 };
        b.addWorksheet('Alpha').getCell('A1').value = 1;
      },
      ['Input'],
      [],
      'Alpha',
    );
    expect(wb.getWorksheet('Alpha')).toBeDefined(); // the team's copy
    expect(formulaOf(wb, 'Alpha', 'B1')).toBe('#REF!A1+1');
    expect(outcome.unrewritten).toContain('Input!B1');
  });

  it('a reference spelt in another case still finds the report sheet it means', async () => {
    const { wb } = await build(
      (b) => {
        b.addWorksheet('Input').getCell('A1').value = 5;
        b.addWorksheet('Calc').getCell('A1').value = { formula: 'input!A1*2', result: 10 };
      },
      ['Input', 'Calc'],
      [],
    );
    expect(formulaOf(wb, 'Beta - Calc', 'A1')).toBe("'Beta - Input'!A1*2");
  });

  it('a team called like the one sheet of the template does not stop the build', async () => {
    const { wb } = await build(
      (b) => {
        b.addWorksheet('Alpha').getCell('A1').value = 5;
      },
      ['Alpha'],
      [],
      'Alpha',
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual(['TỔNG', 'Alpha', META_SHEET_NAME]);
  });

  it('the cells an array formula fills hold no stale sample number in either kind of copy', async () => {
    const { wb } = await build(
      (b) => {
        const ws = b.addWorksheet('Input');
        ws.getCell('A1').value = 1;
        ws.getCell('A2').value = 2;
        ws.getCell('B1').value = { formula: 'A1:A2*2', result: 2, shareType: 'array', ref: 'B1:B2' } as ExcelJS.CellValue;
        ws.getCell('B2').value = 88; // the sample result of the second row
      },
      ['Input'],
      [],
    );
    expect(wb.getWorksheet('TỔNG')?.getCell('B1').value).toBeNull();
    expect(wb.getWorksheet('TỔNG')?.getCell('B2').value).toBeNull();
    expect(wb.getWorksheet('Beta')?.getCell('B2').value).toBeNull();
    expect(wb.getWorksheet('Beta')?.getCell('A1').value).toBe(1); // the rest of the sheet is untouched
  });

  it('a template whose formulas use a named range is refused, rather than exported with #NAME? in every team file', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Input').getCell('A1').value = 5;
    wb.addWorksheet('Calc').getCell('A1').value = { formula: 'Amount*2', result: 10 };
    wb.definedNames.add('Input!$A$1', 'Amount');
    const template = Buffer.from(await wb.xlsx.writeBuffer());
    const grid = await gridOf(template);
    await expect(
      buildPeriodWorkbook(template, {
        selectedSheets: ['Input', 'Calc'],
        fields: [],
        scopes: [{ scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: {} }],
        grid,
        totalOutcomes: {},
        meta: {},
      }),
    ).rejects.toBeInstanceOf(PeriodExportUnsupportedError);
  });

  it('a defined name no formula uses (or the word inside a string or another name) does not block the export', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Input').getCell('A1').value = 5;
    const calc = wb.addWorksheet('Calc');
    calc.getCell('A1').value = { formula: 'IF(1=1,"Amount","x")', result: 'Amount' };
    calc.getCell('A2').value = { formula: 'AmountTotal+1', result: 1 };
    wb.definedNames.add('Input!$A$1', 'Amount');
    const template = Buffer.from(await wb.xlsx.writeBuffer());
    const grid = await gridOf(template);
    const { buffer } = await buildPeriodWorkbook(template, {
      selectedSheets: ['Input', 'Calc'],
      fields: [],
      scopes: [{ scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: {} }],
      grid,
      totalOutcomes: {},
      meta: {},
    });
    expect(buffer.length).toBeGreaterThan(0);
  });
});
