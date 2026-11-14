import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { buildCriteriaWorkbook } from '../template/criteria-workbook';
import { TemplateExportService } from './template-export.service';
import { computeFormulaResults } from './formula-results';
import { META_SHEET_NAME, readExportMeta } from './template-export';
import { PeriodExportTooLargeError } from './period-export';
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

  describe('buildPeriodFile (the manager file)', () => {
    it('builds the totals and every team in one workbook through the real worker', async () => {
      const { service } = build();
      const sheetName = model.sheets[0].name;
      const field = input(firstNumber, sheetName);
      const { buffer, outcome } = await service.buildPeriodFile({
        versionId: 'v1',
        fields: [field],
        scopes: [
          { scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: { [field.fieldKey]: '300' } },
          { scope: 't1', label: 'Đội 3', kind: 'TEAM', values: { [field.fieldKey]: '100' } },
          { scope: 't2', label: 'Đội 4', kind: 'TEAM', values: { [field.fieldKey]: '200' } },
        ],
        totalOutcomes: {},
        meta: { kind: 'PERIOD', versionId: 'v1' },
      });

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      expect(wb.worksheets.map((w) => w.name)).toEqual(['TỔNG', 'Đội 3', 'Đội 4', META_SHEET_NAME]);
      expect(wb.getWorksheet('TỔNG')?.getCell(firstNumber).value).toBe(300);
      expect(wb.getWorksheet('Đội 3')?.getCell(firstNumber).value).toBe(100);
      expect(wb.getWorksheet('Đội 4')?.getCell(firstNumber).value).toBe(200);
      expect((readExportMeta(wb) as Record<string, string>).kind).toBe('PERIOD');
      // The template's formulas had no figure from the system for the totals: blanked, and said so.
      expect(outcome.unresolvedTotals.length).toBeGreaterThan(0);
    });

    it('reads the workbook bytes only once the worker has a slot', async () => {
      const { service, prisma } = build();
      await service.buildPeriodFile({
        versionId: 'v1',
        fields: [],
        scopes: [{ scope: 'TOTAL', label: 'TỔNG', kind: 'TOTAL', values: {} }],
        totalOutcomes: null,
        meta: {},
      });
      const calls = prisma.dynReportVersion.findUnique.mock.calls.map((c) => Object.keys(c[0].select).join(','));
      expect(calls).toEqual(['selectedSheets', 'fileBytes']);
    });

    it('a file too large for one workbook is refused with its own error, from inside the worker', async () => {
      const { service } = build();
      const many = Array.from({ length: 700 }, (_, i) => ({
        scope: `t${i}`,
        label: `Tổ ${i}`,
        kind: 'TEAM' as const,
        values: {},
      }));
      await expect(
        service.buildPeriodFile({ versionId: 'v1', fields: [], scopes: many, totalOutcomes: null, meta: {} }),
      ).rejects.toBeInstanceOf(PeriodExportTooLargeError);
    });

    it('lets a refusal to build the grid reach the caller, who falls back to a plain list', async () => {
      const { service } = build({ getForVersion: jest.fn().mockRejectedValue(new Error('GRID_BUSY')) });
      await expect(
        service.buildPeriodFile({ versionId: 'v1', fields: [], scopes: [], totalOutcomes: null, meta: {} }),
      ).rejects.toThrow('GRID_BUSY');
    });
  });

  describe('the file of a team that reports only some criteria of a grouped list (real generator, real worker)', () => {
    const OWNED_LEAF = 'Tin báo mới tiếp nhận';
    const OWNED_GROUP = 'Nhóm tin báo';
    const UNOWNED_SIBLING = 'Tin báo đã giải quyết';
    const UNOWNED_GROUP = 'Nhóm án khởi tố';
    const UNOWNED_LEAF = 'Số vụ khởi tố';
    const UNOWNED_SUBGROUP = 'Phân nhóm bị can';
    const UNOWNED_DEEP_LEAF = 'Số bị can tạm giam';
    const UNOWNED_ALONE = 'Số vụ tạm đình chỉ';
    const UNOWNED_UNIT = 'đơn-vị-riêng';
    const criterion = (itemKey: string, code: string, name: string, parentItemKey: string | null, unit = 'vụ') => ({
      itemKey, code, name, unit, parentItemKey, origin: 'FILE' as const, sourceRow: null,
    });
    const LIST = [
      criterion('g1', '1', OWNED_GROUP, null),
      criterion('k11', '1.1', OWNED_LEAF, 'g1'),
      criterion('k12', '1.2', UNOWNED_SIBLING, 'g1'),
      criterion('g2', '2', UNOWNED_GROUP, null),
      criterion('k21', '2.1', UNOWNED_LEAF, 'g2', UNOWNED_UNIT),
      criterion('g22', '2.2', UNOWNED_SUBGROUP, 'g2'),
      criterion('k221', '2.2.1', UNOWNED_DEEP_LEAF, 'g22'),
      criterion('k3', '3', UNOWNED_ALONE, null),
    ];

    async function teamFile(ownedItemKeys: string[]): Promise<Buffer> {
      const built = await buildCriteriaWorkbook(LIST);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(built.buffer as unknown as ExcelJS.Buffer);
      const criteriaModel = extractGridModel(wb, {
        selectedSheets: [built.sheetName],
        excludedSheets: [],
        raw: await readRawGridInfo(built.buffer),
      });
      const prisma = {
        dynReportVersion: {
          findUnique: jest.fn(async (args: { select: Record<string, boolean> }) =>
            args.select.fileBytes ? { fileBytes: built.buffer } : { selectedSheets: [built.sheetName] },
          ),
        },
      };
      const service = new TemplateExportService(
        prisma as unknown as PrismaService,
        { getForVersion: jest.fn(async () => ({ model: criteriaModel, etag: '"x"' })) } as unknown as GridModelService,
      );
      const refs = built.fields.map((f) => ({ ...input(f.address, built.sheetName), itemKey: f.itemKey }));
      const owned = refs.filter((f) => ownedItemKeys.includes(f.itemKey));
      return service.buildTeamFile({
        versionId: 'v1',
        fields: refs.map(({ sheetKey, address, fieldKey, type }) => ({ sheetKey, address, fieldKey, type })),
        values: Object.fromEntries(refs.map((f) => [f.fieldKey, owned.includes(f) ? '5' : null])),
        meta: { kind: 'TEAM' },
        unownedCriteria: refs.filter((f) => !owned.includes(f)),
      });
    }
    /** Everything a reader of the file could find: what exceljs shows, and the raw parts of the package themselves. */
    async function everythingIn(file: Buffer): Promise<{ shown: string[]; raw: string }> {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(file as unknown as ExcelJS.Buffer);
      const shown: string[] = [];
      for (const ws of wb.worksheets) ws.eachRow((row) => row.eachCell((cell) => shown.push(String(cell.text))));
      const zip = await JSZip.loadAsync(file);
      const parts = Object.keys(zip.files).filter(
        (name) => !zip.files[name].dir && (name === 'xl/sharedStrings.xml' || name.startsWith('xl/worksheets/')),
      );
      expect(parts).toContain('xl/sharedStrings.xml');
      const raw = (await Promise.all(parts.map((name) => (zip.file(name) as JSZip.JSZipObject).async('string')))).join('\n');
      return { shown, raw };
    }

    it('holds its own criterion and that criterion\'s group; the name of a criterion or of a whole group it was not given is NOWHERE in the file', async () => {
      const { shown, raw } = await everythingIn(await teamFile(['k11']));

      for (const kept of [OWNED_LEAF, OWNED_GROUP]) {
        expect(shown).toContain(kept);
        expect(raw).toContain(kept);
      }
      for (const gone of [UNOWNED_SIBLING, UNOWNED_GROUP, UNOWNED_LEAF, UNOWNED_SUBGROUP, UNOWNED_DEEP_LEAF, UNOWNED_ALONE, UNOWNED_UNIT]) {
        expect(shown).not.toContain(gone);
        expect(raw).not.toContain(gone);
      }
    });

    it('a group the team has one criterion of keeps its heading, and the heading adds up what the team has', async () => {
      const file = await teamFile(['k11', 'k21']);
      const { shown, raw } = await everythingIn(file);

      for (const kept of [OWNED_LEAF, OWNED_GROUP, UNOWNED_LEAF, UNOWNED_GROUP]) expect(raw).toContain(kept);
      for (const gone of [UNOWNED_SIBLING, UNOWNED_SUBGROUP, UNOWNED_DEEP_LEAF, UNOWNED_ALONE]) {
        expect(shown).not.toContain(gone);
        expect(raw).not.toContain(gone);
      }
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(file as unknown as ExcelJS.Buffer);
      // Row 2 is group "1" (= 1.1 + 1.2): the team typed 5 for 1.1 and has no 1.2, so the heading shows 5.
      expect(wb.worksheets[0].getCell('C2').value).toMatchObject({ formula: 'SUM(C3,C4)', result: 5 });
    });

    it('a team that reports everything gets the whole list', async () => {
      const { raw } = await everythingIn(await teamFile(LIST.map((c) => c.itemKey)));
      for (const name of LIST.map((c) => c.name)) expect(raw).toContain(name);
    });
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
