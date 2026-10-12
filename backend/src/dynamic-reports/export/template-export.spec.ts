import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  META_SHEET_NAME,
  buildTemplateWorkbook,
  isDateTimeFormat,
  toExactNumber,
} from './template-export';
import type { ExportField, FormulaResult, TemplateExportRequest } from './template-export';
import { extractGridModel } from '../template/grid-extract';
import { readRawGridInfo } from '../template/grid-raw';
import { readImportCellRaw } from '../engine/import-cell';
import { evaluateGridWorkbook } from '../engine/grid-workbook';
import type { GridModel } from '../engine/grid-types';

/**
 * The exported file must be the template with the numbers in it: same look,
 * same structure, values written where the officer typed them and readable
 * back by the importer. Every comparison against the original file is made
 * through the grid extractor (an independent reading of the .xlsx), never by
 * trusting the writer's own bookkeeping.
 */

const REAL = path.join(__dirname, '../../../test/fixtures/dynamic-reports/real');
const load = (stem: string) => fs.readFileSync(path.join(REAL, `${stem}.xlsx`));

async function gridOf(buffer: Buffer, sheets?: string[]): Promise<GridModel> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const raw = await readRawGridInfo(buffer);
  const names = (sheets ?? wb.worksheets.map((w) => w.name)).filter((n) => wb.getWorksheet(n));
  return extractGridModel(wb, { selectedSheets: names, excludedSheets: [], raw });
}

/**
 * One cell exactly as it is stored in the file. exceljs reads a cached result of FALSE or 0 back as "no result", so
 * asserting through exceljs would hide (or invent) a problem: look at the XML a spreadsheet program will see.
 */
async function cellXml(buffer: Buffer, sheetName: string, address: string): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await (zip.file('xl/workbook.xml') as JSZip.JSZipObject).async('string');
  const rels = await (zip.file('xl/_rels/workbook.xml.rels') as JSZip.JSZipObject).async('string');
  const sheetTag = (workbookXml.match(/<sheet\b[^>]*>/g) ?? []).find((t) => t.includes(`name="${sheetName}"`)) as string;
  const rid = /r:id="([^"]+)"/.exec(sheetTag)?.[1] as string;
  const relTag = (rels.match(/<Relationship\b[^>]*>/g) ?? []).find((t) => t.includes(`Id="${rid}"`)) as string;
  const target = /Target="([^"]+)"/.exec(relTag)?.[1] as string;
  const xml = await (zip.file(`xl/${target}`) as JSZip.JSZipObject).async('string');
  return new RegExp(`<c r="${address}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`).exec(xml)?.[0] ?? '';
}

describe('toExactNumber / isDateTimeFormat', () => {
  it.each([
    ['1234.5', 1234.5],
    ['-7', -7],
    ['0.1', 0.1],
    ['123456789012345', 123456789012345],
  ])('%s is written as a number', (text, n) => {
    expect(toExactNumber(text)).toBe(n);
  });

  it.each(['1234567890123456', '9007199254740993', '0.1234567890123456', '12345678901234567890'])(
    '%s has more than Excel keeps and is written as text',
    (text) => {
      expect(toExactNumber(text)).toBeNull();
    },
  );

  it.each(['abc', '', 'Infinity', 'NaN'])('%j is not a number', (text) => {
    expect(toExactNumber(text)).toBeNull();
  });

  it('knows date and time formats from the rest', () => {
    for (const code of ['dd/mm/yyyy', 'd-mmm-yy', 'hh:mm', 'h:mm AM/PM', '[$-409]mmmm d, yyyy', 'yyyy-mm-dd hh:mm']) {
      expect(isDateTimeFormat(code)).toBe(true);
    }
    for (const code of [undefined, '', 'General', '0.00', '#,##0', '0%', '@', '"d" 0', '[Red]0.0', '0.0 "ms"']) {
      expect(isDateTimeFormat(code)).toBe(false);
    }
  });
});

describe('buildTemplateWorkbook on a real template (pl7)', () => {
  const template = load('pl7');
  let original: GridModel;
  let sheetName: string;
  let numberCells: string[];

  beforeAll(async () => {
    original = await gridOf(template);
    sheetName = original.sheets[0].name;
    numberCells = Object.entries(original.sheets[0].cells)
      .filter(([, c]) => c.k === 'num')
      .map(([a]) => a)
      .slice(0, 4);
  });

  function request(over: Partial<TemplateExportRequest> = {}): TemplateExportRequest {
    const fields: ExportField[] = [
      ...numberCells.map((address) => ({ sheetKey: sheetName, address, fieldKey: `${sheetName}!${address}`, type: 'NUM' as const })),
      { sheetKey: sheetName, address: 'Z1', fieldKey: `${sheetName}!Z1`, type: 'TEXT' },
      { sheetKey: sheetName, address: 'Z2', fieldKey: `${sheetName}!Z2`, type: 'DATE' },
      { sheetKey: sheetName, address: 'Z3', fieldKey: `${sheetName}!Z3`, type: 'TIME' },
    ];
    const values: Record<string, string | null> = {
      [`${sheetName}!${numberCells[0]}`]: '1234.5',
      [`${sheetName}!${numberCells[1]}`]: '7',
      [`${sheetName}!${numberCells[2]}`]: null,
      [`${sheetName}!Z1`]: '=1+1 xin chào',
      [`${sheetName}!Z2`]: '2026-07-04',
      [`${sheetName}!Z3`]: '08:05',
    };
    return {
      selectedSheets: [sheetName],
      fields,
      values,
      formulaResults: {},
      meta: { reportId: 'r1', versionId: 'v1' },
      ...over,
    };
  }

  it('writes each value into its cell with its type, and clears a blank', async () => {
    const { buffer } = await buildTemplateWorkbook(template, request());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.getWorksheet(sheetName) as ExcelJS.Worksheet;
    expect(ws.getCell(numberCells[0]).value).toBe(1234.5);
    expect(ws.getCell(numberCells[1]).value).toBe(7);
    expect(ws.getCell(numberCells[2]).value).toBeNull();
    expect(ws.getCell('Z1').value).toBe('=1+1 xin chào'); // text stays text, never a formula
    expect(ws.getCell('Z2').value).toEqual(new Date(Date.UTC(2026, 6, 4)));
    expect(ws.getCell('Z3').value).toBeInstanceOf(Date);
  });

  it('what is exported reads back unchanged through the importer', async () => {
    const req = request();
    const { buffer } = await buildTemplateWorkbook(template, req);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.getWorksheet(sheetName) as ExcelJS.Worksheet;
    for (const f of req.fields) {
      const expected = req.values[f.fieldKey];
      expect(readImportCellRaw(ws.getCell(f.address), f.type)).toBe(expected ?? null);
    }
  });

  it('a date or time lands in a cell that really is a date or a time', async () => {
    const { buffer } = await buildTemplateWorkbook(template, request());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.getWorksheet(sheetName) as ExcelJS.Worksheet;
    expect(isDateTimeFormat(ws.getCell('Z2').numFmt)).toBe(true);
    expect(isDateTimeFormat(ws.getCell('Z3').numFmt)).toBe(true);
  });

  it('gives a bare date or time cell OUR formats (day first), but respects one the template already chose', async () => {
    const wb0 = new ExcelJS.Workbook();
    await wb0.xlsx.load(template as unknown as ExcelJS.Buffer);
    const ws0 = wb0.getWorksheet(sheetName) as ExcelJS.Worksheet;
    ws0.getCell('Z2').numFmt = '#,##0.00'; // a number format sitting on what is really a date cell
    ws0.getCell('Z3').numFmt = 'h:mm AM/PM'; // the author already chose a time format
    const prepared = Buffer.from(await wb0.xlsx.writeBuffer());

    const { buffer } = await buildTemplateWorkbook(prepared, request());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.getWorksheet(sheetName) as ExcelJS.Worksheet;
    expect(ws.getCell('Z2').numFmt).toBe('dd/mm/yyyy');
    expect(ws.getCell('Z3').numFmt).toBe('h:mm AM/PM');
    // And the bare-General case:
    const plain = await buildTemplateWorkbook(template, request());
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(plain.buffer as unknown as ExcelJS.Buffer);
    const ws2 = wb2.getWorksheet(sheetName) as ExcelJS.Worksheet;
    expect(ws2.getCell('Z2').numFmt).toBe('dd/mm/yyyy');
    expect(ws2.getCell('Z3').numFmt).toBe('hh:mm');
  });

  it('a number Excel cannot hold is written as text, exactly, and listed', async () => {
    const key = `${sheetName}!${numberCells[0]}`;
    const { buffer, outcome } = await buildTemplateWorkbook(
      template,
      request({ values: { [key]: '9007199254740993' } }),
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect((wb.getWorksheet(sheetName) as ExcelJS.Worksheet).getCell(numberCells[0]).value).toBe('9007199254740993');
    expect(outcome.textNumbers).toEqual([key]);
    const meta = (wb.getWorksheet(META_SHEET_NAME) as ExcelJS.Worksheet).getSheetValues().flat();
    expect(meta).toContain(key);
  });

  it('keeps the look of the template: geometry, merges, panes and every cell style', async () => {
    const { buffer } = await buildTemplateWorkbook(template, request());
    const after = await gridOf(buffer, [sheetName]);
    const before = original.sheets[0];
    const got = after.sheets[0];
    // The test writes into columns past the template's used range (Z), which only adds default-width columns.
    expect(got.colWidthsPx.slice(0, before.colWidthsPx.length)).toEqual(before.colWidthsPx);
    expect(got.rowHeightsPx.slice(0, before.rowHeightsPx.length)).toEqual(before.rowHeightsPx);
    const byPosition = (m: { top: number; left: number }) => `${m.top},${m.left}`;
    expect([...got.merges].sort((a, b) => byPosition(a).localeCompare(byPosition(b), 'en', { numeric: true }))).toEqual(
      [...before.merges].sort((a, b) => byPosition(a).localeCompare(byPosition(b), 'en', { numeric: true })),
    );
    expect(got.freeze).toEqual(before.freeze);
    expect(got.hiddenRows).toEqual(before.hiddenRows);
    expect(got.hiddenCols).toEqual(before.hiddenCols);
    const wrong: string[] = [];
    for (const [address, cell] of Object.entries(before.cells)) {
      const was = original.styles[cell.s];
      const gotCell = got.cells[address];
      const now = gotCell ? after.styles[gotCell.s] : undefined;
      // Input cells may gain a date/time number format; everything else must be untouched.
      const { numFmt: _a, ...wasRest } = was ?? {};
      const { numFmt: _b, ...nowRest } = now ?? {};
      void _a;
      void _b;
      if (JSON.stringify(wasRest) !== JSON.stringify(nowRest)) wrong.push(address);
    }
    expect(wrong).toEqual([]);
  });

  it('every static label and number outside the inputs is untouched', async () => {
    const { buffer } = await buildTemplateWorkbook(template, request());
    const after = await gridOf(buffer, [sheetName]);
    const inputs = new Set(request().fields.map((f) => f.address));
    const changed: string[] = [];
    for (const [address, cell] of Object.entries(original.sheets[0].cells)) {
      if (inputs.has(address) || cell.k === 'formula') continue;
      const now = after.sheets[0].cells[address];
      if (JSON.stringify({ ...cell, s: 0 }) !== JSON.stringify({ ...(now ?? { k: 'empty' }), s: 0 })) changed.push(address);
    }
    expect(changed).toEqual([]);
  });

  it('formulas stay formulas, and carry the freshly worked-out result', async () => {
    const formulaCell = Object.entries(original.sheets[0].cells).find(([, c]) => c.k === 'formula') as [string, { k: 'formula'; f: string }];
    const results: Record<string, FormulaResult> = { [`${sheetName}!${formulaCell[0]}`]: { kind: 'number', value: 42.5 } };
    const { buffer } = await buildTemplateWorkbook(template, request({ formulaResults: results }));
    const xml = await cellXml(buffer, sheetName, formulaCell[0]);
    expect(xml).toMatch(/<f[ >]/); // still a formula
    expect(xml).toContain('<v>42.5</v>'); // with today's result
  });

  it('a formula result of FALSE, 0 or an empty string is written to the file, not left blank', async () => {
    const formulaCells = Object.entries(original.sheets[0].cells)
      .filter(([, c]) => c.k === 'formula')
      .map(([a]) => a)
      .slice(0, 3);
    expect(formulaCells.length).toBe(3);
    const results: Record<string, FormulaResult> = {
      [`${sheetName}!${formulaCells[0]}`]: { kind: 'boolean', value: false },
      [`${sheetName}!${formulaCells[1]}`]: { kind: 'number', value: 0 },
      [`${sheetName}!${formulaCells[2]}`]: { kind: 'string', value: '' },
    };
    const { buffer } = await buildTemplateWorkbook(template, request({ formulaResults: results }));
    const [falseXml, zeroXml, emptyXml] = await Promise.all(formulaCells.map((a) => cellXml(buffer, sheetName, a)));
    expect(falseXml).toMatch(/t="b"[^>]*>.*<v>0<\/v>/);
    expect(zeroXml).toContain('<v>0</v>');
    expect(zeroXml).not.toContain('t="b"');
    expect(emptyXml).toMatch(/<v><\/v>|<v\/>/);
  });

  it('asks Excel to recalculate on open', async () => {
    const { buffer } = await buildTemplateWorkbook(template, request());
    const zip = await JSZip.loadAsync(buffer);
    const workbookXml = await (zip.file('xl/workbook.xml') as JSZip.JSZipObject).async('string');
    expect(workbookXml).toMatch(/<calcPr[^>]*fullCalcOnLoad="1"/);
  });

  it('adds a hidden metadata sheet with the identity of the export', async () => {
    const { buffer } = await buildTemplateWorkbook(template, request({ meta: { reportId: 'r1', teamId: 't9' } }));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const meta = wb.getWorksheet(META_SHEET_NAME) as ExcelJS.Worksheet;
    expect(meta.state).toBe('veryHidden');
    expect(meta.getRow(1).values).toEqual([undefined, 'reportId', 'r1']);
    expect(meta.getRow(2).values).toEqual([undefined, 'teamId', 't9']);
  });
});

describe('sheets', () => {
  it('drops every sheet the report does not use and keeps the original names and order', async () => {
    const template = load('hsln_17_sheets');
    const wb0 = new ExcelJS.Workbook();
    await wb0.xlsx.load(template as unknown as ExcelJS.Buffer);
    expect(wb0.worksheets.length).toBeGreaterThan(5);
    const chosen = wb0.worksheets.slice(1, 3).map((w) => w.name);

    const { buffer } = await buildTemplateWorkbook(template, {
      selectedSheets: chosen,
      fields: [],
      values: {},
      formulaResults: {},
      meta: {},
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([...chosen, META_SHEET_NAME]);
  });
});

describe('the whole chain: submitted values → calculated results → file', () => {
  it('the results written into the file are the ones the shared calculator produces', async () => {
    const template = load('a10_99_formulas');
    const model = await gridOf(template);
    const sheet = model.sheets[0];
    const firstNumber = Object.entries(sheet.cells).find(([, c]) => c.k === 'num') as [string, { k: 'num' }];
    const field: ExportField = {
      sheetKey: sheet.name,
      address: firstNumber[0],
      fieldKey: `${sheet.name}!${firstNumber[0]}`,
      type: 'NUM',
    };
    const values = { [field.fieldKey]: '1000' };
    const { evaluator } = evaluateGridWorkbook(model, [field], values);

    const formulaResults: Record<string, FormulaResult> = {};
    for (const s of model.sheets) {
      for (const [address, cell] of Object.entries(s.cells)) {
        if (cell.k !== 'formula') continue;
        const r = evaluator.get(s.name, address);
        if (r?.ok && r.value.type === 'number') {
          formulaResults[`${s.name}!${address}`] = { kind: 'number', value: Number(r.value.value) };
        }
      }
    }
    expect(Object.keys(formulaResults).length).toBeGreaterThan(0);

    const { buffer } = await buildTemplateWorkbook(template, {
      selectedSheets: model.sheets.map((s) => s.name),
      fields: [field],
      values,
      formulaResults,
      meta: {},
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    for (const [key, result] of Object.entries(formulaResults)) {
      const bang = key.lastIndexOf('!');
      const xml = await cellXml(buffer, key.slice(0, bang), key.slice(bang + 1));
      expect(xml).toContain(`<v>${(result as { value: number }).value}</v>`);
    }
  });
});
