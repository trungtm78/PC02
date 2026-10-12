import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { META_SHEET_NAME, buildTemplateWorkbook } from './template-export';
import type { ExportField, TemplateExportRequest } from './template-export';
import { readImportCellRaw } from '../engine/import-cell';
import type { GridModel } from '../engine/grid-types';

// exceljs round trips of a whole workbook are slow on a busy runner.
jest.setTimeout(30_000);

/**
 * Review findings on the template export: what must NOT leave with the file
 * (pictures and names of dropped sheets), and the edge cases of the .xlsx
 * format a real template runs into (1904 calendar, date-formatted number cells,
 * tiny decimals, cells that cannot hold what a field accepts).
 */

/** A 1x1 PNG, enough for exceljs to treat as a picture. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function buildTemplate(setup: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  setup(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const emptyRequest = (sheets: string[], over: Partial<TemplateExportRequest> = {}): TemplateExportRequest => ({
  selectedSheets: sheets,
  fields: [],
  values: {},
  meta: {},
  ...over,
});

async function names(buffer: Buffer): Promise<string[]> {
  return Object.keys((await JSZip.loadAsync(buffer)).files);
}

/** The picture files in the package (not the folder entry). */
async function pictures(buffer: Buffer): Promise<string[]> {
  return (await names(buffer)).filter((n) => n.startsWith('xl/media/') && !n.endsWith('/'));
}

async function part(buffer: Buffer, name: string): Promise<string> {
  return (await (await JSZip.loadAsync(buffer)).file(name)?.async('string')) ?? '';
}

/** One cell exactly as it is stored in the first worksheet part. */
async function cellXml(buffer: Buffer, address: string): Promise<string> {
  const sheetPart = (await names(buffer)).find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)) as string;
  const xml = await part(buffer, sheetPart);
  return new RegExp(`<c r="${address}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`).exec(xml)?.[0] ?? '';
}

async function reload(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return wb;
}

describe('nothing from a dropped sheet travels with the file', () => {
  it('pictures that belonged only to a dropped sheet are not in the package', async () => {
    const template = await buildTemplate((wb) => {
      wb.addWorksheet('Public').getCell('A1').value = 'công khai';
      const other = wb.addWorksheet('OtherTeam');
      other.getCell('A1').value = 'tổ khác';
      const id = wb.addImage({ buffer: TINY_PNG as unknown as ExcelJS.Buffer, extension: 'png' });
      other.addImage(id, 'B2:C3');
    });
    expect(await pictures(template)).toHaveLength(1);

    const { buffer } = await buildTemplateWorkbook(template, emptyRequest(['Public']));
    expect(await pictures(buffer)).toEqual([]);
  });

  it('a picture on a sheet that is kept stays', async () => {
    const template = await buildTemplate((wb) => {
      const keep = wb.addWorksheet('Keep');
      keep.getCell('A1').value = 'x';
      const id = wb.addImage({ buffer: TINY_PNG as unknown as ExcelJS.Buffer, extension: 'png' });
      keep.addImage(id, 'B2:C3');
      wb.addWorksheet('Drop').getCell('A1').value = 'y';
    });
    const { buffer } = await buildTemplateWorkbook(template, emptyRequest(['Keep']));
    expect(await pictures(buffer)).toHaveLength(1);
  });

  it('names that point into a dropped sheet are removed, names on kept sheets stay', async () => {
    const template = await buildTemplate((wb) => {
      wb.addWorksheet('Keep').getCell('A1').value = 1;
      wb.addWorksheet('Drop').getCell('A1').value = 2;
      wb.definedNames.add('Drop!$A$1', 'DroppedName');
      wb.definedNames.add('Keep!$A$1', 'KeptName');
    });
    const { buffer } = await buildTemplateWorkbook(template, emptyRequest(['Keep']));
    const xml = await part(buffer, 'xl/workbook.xml');
    expect(xml).not.toContain('DroppedName');
    expect(xml).toContain('KeptName');
  });
});

describe('formulas the engine cannot judge get no cached value, not a wrong one', () => {
  it('a result of kind "none" removes the template\'s stale cached value and keeps the formula', async () => {
    const template = await buildTemplate((wb) => {
      const ws = wb.addWorksheet('S');
      ws.getCell('A1').value = 2;
      ws.getCell('B1').value = { formula: 'A1*2', result: 4 };
    });
    const { buffer } = await buildTemplateWorkbook(
      template,
      emptyRequest(['S'], { formulaResults: { 'S!B1': { kind: 'none' } } }),
    );
    const xml = await cellXml(buffer, 'B1');
    expect(xml).toMatch(/<f[ >]/);
    expect(xml).not.toContain('<v>');
  });

  it('a division by zero is written as Excel\'s own #DIV/0!', async () => {
    const template = await buildTemplate((wb) => {
      wb.addWorksheet('S').getCell('B1').value = { formula: '1/A1', result: 1 };
    });
    const { buffer } = await buildTemplateWorkbook(
      template,
      emptyRequest(['S'], { formulaResults: { 'S!B1': { kind: 'error', value: '#DIV/0!' } } }),
    );
    const xml = await cellXml(buffer, 'B1');
    expect(xml).toContain('t="e"');
    expect(xml).toContain('#DIV/0!');
  });

  it('the calculation runs from the model carried in the request (so it happens in the worker)', async () => {
    const template = await buildTemplate((wb) => {
      wb.addWorksheet('S').getCell('B1').value = { formula: 'A1*2', result: 0 };
    });
    const grid = {
      engineVersion: 1,
      dateSystem: 1900,
      sheetOrder: ['S'],
      excludedSheets: [],
      styles: [{}],
      defaultFont: { name: 'Calibri', sizePt: 11 },
      warnings: [],
      sheets: [
        {
          name: 'S',
          rows: 1,
          cols: 2,
          colWidthsPx: [],
          rowHeightsPx: [],
          hiddenRows: [],
          hiddenCols: [],
          merges: [],
          freeze: { rows: 0, cols: 0 },
          showGridlines: true,
          showZeros: true,
          zoom: 100,
          cells: { A1: { k: 'empty', s: 0 }, B1: { k: 'formula', f: 'A1*2', s: 0 } },
          colStyles: [],
          rowStyles: {},
          conditionalFormats: [],
          validations: [],
        },
      ],
    } as unknown as GridModel;
    const field: ExportField = { sheetKey: 'S', address: 'A1', fieldKey: 'S!A1', type: 'NUM' };
    const { buffer } = await buildTemplateWorkbook(
      template,
      emptyRequest(['S'], { grid, fields: [field], values: { 'S!A1': '21' } }),
    );
    expect(await cellXml(buffer, 'B1')).toContain('<v>42</v>');
  });
});

describe('edge cases of the file format', () => {
  it('a NUMBER written into a cell the template formats as a date still reads back as that number', async () => {
    const template = await buildTemplate((wb) => {
      wb.addWorksheet('S').getCell('A1').numFmt = 'dd/mm/yyyy';
    });
    const field: ExportField = { sheetKey: 'S', address: 'A1', fieldKey: 'S!A1', type: 'NUM' };
    const { buffer } = await buildTemplateWorkbook(
      template,
      emptyRequest(['S'], { fields: [field], values: { 'S!A1': '123' } }),
    );
    const wb = await reload(buffer);
    expect(readImportCellRaw((wb.getWorksheet('S') as ExcelJS.Worksheet).getCell('A1'), 'NUM')).toBe('123');
  });

  it('a 1904-calendar workbook gets times and dates on ITS calendar, never a negative serial', async () => {
    const template = await buildTemplate((wb) => {
      wb.properties.date1904 = true;
      wb.addWorksheet('S');
    });
    const fields: ExportField[] = [
      { sheetKey: 'S', address: 'A1', fieldKey: 'S!A1', type: 'TIME' },
      { sheetKey: 'S', address: 'A2', fieldKey: 'S!A2', type: 'DATE' },
    ];
    const { buffer } = await buildTemplateWorkbook(
      template,
      emptyRequest(['S'], { fields, values: { 'S!A1': '08:05', 'S!A2': '2026-07-04' } }),
    );
    const time = Number(/<v>([^<]+)<\/v>/.exec(await cellXml(buffer, 'A1'))?.[1]);
    expect(time).toBeCloseTo((8 * 60 + 5) / 1440, 9);
    const date = Number(/<v>([^<]+)<\/v>/.exec(await cellXml(buffer, 'A2'))?.[1]);
    expect(date).toBe(Math.round((Date.UTC(2026, 6, 4) - Date.UTC(1904, 0, 1)) / 86_400_000));
    const ws = (await reload(buffer)).getWorksheet('S') as ExcelJS.Worksheet;
    expect(readImportCellRaw(ws.getCell('A1'), 'TIME')).toBe('08:05');
    expect(readImportCellRaw(ws.getCell('A2'), 'DATE')).toBe('2026-07-04');
  });

  it('a very small decimal survives export → import without turning into 1e-7', async () => {
    const template = await buildTemplate((wb) => {
      wb.addWorksheet('S');
    });
    const field: ExportField = { sheetKey: 'S', address: 'A1', fieldKey: 'S!A1', type: 'NUM' };
    const { buffer } = await buildTemplateWorkbook(
      template,
      emptyRequest(['S'], { fields: [field], values: { 'S!A1': '0.0000001' } }),
    );
    const ws = (await reload(buffer)).getWorksheet('S') as ExcelJS.Worksheet;
    expect(readImportCellRaw(ws.getCell('A1'), 'NUM')).toBe('0.0000001');
  });

  it('text longer than a cell can hold is cut at the limit and listed, instead of making Excel call the file damaged', async () => {
    const template = await buildTemplate((wb) => {
      wb.addWorksheet('S');
    });
    const field: ExportField = { sheetKey: 'S', address: 'A1', fieldKey: 'S!A1', type: 'TEXT' };
    const { buffer, outcome } = await buildTemplateWorkbook(
      template,
      emptyRequest(['S'], { fields: [field], values: { 'S!A1': 'x'.repeat(40_000) } }),
    );
    const wb = await reload(buffer);
    expect(((wb.getWorksheet('S') as ExcelJS.Worksheet).getCell('A1').value as string).length).toBe(32_767);
    expect(outcome.truncated).toEqual(['S!A1']);
    expect(JSON.stringify((wb.getWorksheet(META_SHEET_NAME) as ExcelJS.Worksheet).getSheetValues())).toContain('truncated');
  });

  it('many text-numbers are listed one per row, never packed into one cell', async () => {
    const template = await buildTemplate((wb) => {
      wb.addWorksheet('S');
    });
    const fields: ExportField[] = Array.from({ length: 5 }, (_, i) => ({
      sheetKey: 'S',
      address: `A${i + 1}`,
      fieldKey: `S!A${i + 1}`,
      type: 'NUM' as const,
    }));
    const values = Object.fromEntries(fields.map((f) => [f.fieldKey, '9007199254740993']));
    const { buffer } = await buildTemplateWorkbook(template, emptyRequest(['S'], { fields, values }));
    const wb = await reload(buffer);
    const rows: unknown[] = [];
    (wb.getWorksheet(META_SHEET_NAME) as ExcelJS.Worksheet).eachRow((r) => rows.push(r.getCell(1).value));
    expect(rows.filter((v) => v === 'textNumber')).toHaveLength(5);
  });

  it('a sheet called __dr_meta in the template never collides with the identity sheet', async () => {
    const template = await buildTemplate((wb) => {
      wb.addWorksheet('S').getCell('A1').value = 1;
      wb.addWorksheet(META_SHEET_NAME).getCell('A1').value = 'from an earlier export';
    });
    const { buffer } = await buildTemplateWorkbook(
      template,
      emptyRequest(['S', META_SHEET_NAME], { meta: { kind: 'TEAM' } }),
    );
    const wb = await reload(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['S', META_SHEET_NAME]);
    expect((wb.getWorksheet(META_SHEET_NAME) as ExcelJS.Worksheet).getRow(1).values).toEqual([undefined, 'kind', 'TEAM']);
  });

  it('a sheet name with an apostrophe never leaves a malformed print area behind', async () => {
    // exceljs cannot WRITE this correctly (it can read it), so the template is made the way Excel makes it.
    const base = await buildTemplate((wb) => {
      wb.addWorksheet("O'Brien").getCell('A1').value = 1;
    });
    const zip = await JSZip.loadAsync(base);
    const xml = await (zip.file('xl/workbook.xml') as JSZip.JSZipObject).async('string');
    zip.file(
      'xl/workbook.xml',
      xml.replace(
        '</sheets>',
        "</sheets><definedNames><definedName name=\"_xlnm.Print_Area\" localSheetId=\"0\">'O''Brien'!$A$1:$B$9</definedName></definedNames>",
      ),
    );
    const template = await zip.generateAsync({ type: 'nodebuffer' });

    const { buffer } = await buildTemplateWorkbook(template, emptyRequest(["O'Brien"]));
    expect(await part(buffer, 'xl/workbook.xml')).not.toContain("'O'Brien'!");
    await expect(reload(buffer)).resolves.toBeDefined();
  });
});
