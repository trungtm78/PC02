import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { TemplateExportService } from './template-export.service';
import { computeFormulaResults } from './formula-results';
import { META_SHEET_NAME } from './template-export';
import { extractGridModel } from '../template/grid-extract';
import { readRawGridInfo } from '../template/grid-raw';
import type { GridModel, GridSheet } from '../engine/grid-types';
import type { InputFieldRef } from '../engine/grid-workbook';
import type { PrismaService } from '../../prisma/prisma.service';
import type { GridModelService } from '../grid/grid-model.service';

const REAL = path.join(__dirname, '../../../test/fixtures/dynamic-reports/real');

// The real worker compiles TypeScript on start-up; under a busy runner that takes longer than jest's default 5 s.
jest.setTimeout(30_000);

function sheet(name: string, cells: GridSheet['cells']): GridSheet {
  return {
    name,
    rows: 5,
    cols: 5,
    colWidthsPx: [],
    rowHeightsPx: [],
    hiddenRows: [],
    hiddenCols: [],
    merges: [],
    freeze: { rows: 0, cols: 0 },
    showGridlines: true,
    showZeros: true,
    zoom: 100,
    cells,
    colStyles: [],
    rowStyles: {},
    conditionalFormats: [],
    validations: [],
  };
}

function grid(sheets: GridSheet[]): GridModel {
  return {
    engineVersion: 1,
    dateSystem: 1900,
    sheetOrder: sheets.map((s) => s.name),
    excludedSheets: [],
    styles: [{}],
    defaultFont: { name: 'Calibri', sizePt: 11 },
    sheets,
    warnings: [],
  };
}

const input = (address: string, sheetKey = 'S'): InputFieldRef => ({
  sheetKey,
  address,
  fieldKey: `${sheetKey}!${address}`,
  type: 'NUM',
});

describe('computeFormulaResults', () => {
  const model = grid([
    sheet('S', {
      A1: { k: 'empty', s: 0 },
      A2: { k: 'formula', f: 'A1*2', s: 0 },
      A3: { k: 'formula', f: '1/A1', s: 0 },
      A4: { k: 'formula', f: 'IF(A1>0,"dương","không")', s: 0 },
      A5: { k: 'formula', f: 'A1>0', s: 0 },
      A6: { k: 'formula', f: '"abc"*2', s: 0 },
    }),
  ]);

  it('numbers, text and booleans come back as the kinds the file stores', () => {
    const r = computeFormulaResults(model, [input('A1')], { 'S!A1': '4' });
    expect(r['S!A2']).toEqual({ kind: 'number', value: 8 });
    expect(r['S!A3']).toEqual({ kind: 'number', value: 0.25 });
    expect(r['S!A4']).toEqual({ kind: 'string', value: 'dương' });
    expect(r['S!A5']).toEqual({ kind: 'boolean', value: true });
  });

  it('a formula that fails carries Excel\'s own error literal, not a number', () => {
    const r = computeFormulaResults(model, [input('A1')], { 'S!A1': '0' });
    expect(r['S!A3']).toEqual({ kind: 'error', value: '#DIV/0!' });
    expect(r['S!A2']).toEqual({ kind: 'number', value: 0 });
    expect(r['S!A5']).toEqual({ kind: 'boolean', value: false });
  });

  it('a blank input is a blank, as in Excel: 1/blank is a division by zero', () => {
    const r = computeFormulaResults(model, [input('A1')], {});
    expect(r['S!A3']).toEqual({ kind: 'error', value: '#DIV/0!' });
  });

  it('a formula the engine cannot judge gets NO cached value rather than a confident wrong one', () => {
    const r = computeFormulaResults(model, [input('A1')], { 'S!A1': '1' });
    expect(r['S!A6']).toEqual({ kind: 'none' });
  });

  it('every formula of the model gets a result, and nothing else does', () => {
    const r = computeFormulaResults(model, [input('A1')], { 'S!A1': '1' });
    expect(Object.keys(r).sort()).toEqual(['S!A2', 'S!A3', 'S!A4', 'S!A5', 'S!A6']);
  });
});

describe('TemplateExportService (real worker, real template)', () => {
  const bytes = fs.readFileSync(path.join(REAL, 'a10_99_formulas.xlsx'));
  let model: GridModel;
  let firstNumber: string;

  beforeAll(async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const raw = await readRawGridInfo(bytes);
    const names = wb.worksheets.map((w) => w.name);
    model = extractGridModel(wb, { selectedSheets: names, excludedSheets: [], raw });
    firstNumber = Object.entries(model.sheets[0].cells).find(([, c]) => c.k === 'num')?.[0] as string;
  });

  function build(grids: Partial<GridModelService> = {}) {
    const prisma = {
      dynReportVersion: {
        findUnique: jest.fn(async (args: { select: Record<string, boolean> }) =>
          args.select.fileBytes
            ? { fileBytes: bytes }
            : { selectedSheets: model.sheets.map((s) => s.name) },
        ),
      },
    };
    const gridService = {
      getForVersion: jest.fn(async () => ({ model, etag: '"x"' })),
      ...grids,
    };
    return {
      service: new TemplateExportService(
        prisma as unknown as PrismaService,
        gridService as unknown as GridModelService,
      ),
      prisma,
      gridService,
    };
  }

  it('returns the template with the values written in, its formulas recalculated and an identity sheet', async () => {
    const { service } = build();
    const sheetName = model.sheets[0].name;
    const field = input(firstNumber, sheetName);
    const file = await service.buildTeamFile({
      versionId: 'v1',
      fields: [field],
      values: { [field.fieldKey]: '1000' },
      meta: { kind: 'TEAM', versionId: 'v1', assignmentId: 'a1' },
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file as unknown as ExcelJS.Buffer);
    expect(wb.getWorksheet(sheetName)?.getCell(firstNumber).value).toBe(1000);
    expect(wb.worksheets.map((w) => w.name)).toEqual([...model.sheets.map((s) => s.name), META_SHEET_NAME]);
    const meta = wb.getWorksheet(META_SHEET_NAME) as ExcelJS.Worksheet;
    expect(meta.getRow(1).values).toEqual([undefined, 'kind', 'TEAM']);
  });

  it('reads the workbook bytes only once the worker has a slot, never before', async () => {
    const { service, prisma } = build();
    const sheetName = model.sheets[0].name;
    await service.buildTeamFile({
      versionId: 'v1',
      fields: [input(firstNumber, sheetName)],
      values: {},
      meta: {},
    });
    const calls = prisma.dynReportVersion.findUnique.mock.calls.map((c) => Object.keys(c[0].select).join(','));
    expect(calls).toEqual(['selectedSheets', 'fileBytes']);
  });

  it('lets a refusal to build the grid reach the caller, who falls back to a plain list', async () => {
    const { service } = build({
      getForVersion: jest.fn().mockRejectedValue(new Error('GRID_BUSY')),
    });
    await expect(
      service.buildTeamFile({ versionId: 'v1', fields: [], values: {}, meta: {} }),
    ).rejects.toThrow('GRID_BUSY');
  });

  it('an unknown version is a plain not-found', async () => {
    const prisma = { dynReportVersion: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new TemplateExportService(
      prisma as unknown as PrismaService,
      { getForVersion: jest.fn() } as unknown as GridModelService,
    );
    await expect(
      service.buildTeamFile({ versionId: 'nope', fields: [], values: {}, meta: {} }),
    ).rejects.toThrow(/Không tìm thấy/);
  });
});
