import * as ExcelJS from 'exceljs';
import { computeFormulaResults } from './formula-results';
import { pruneUnreferencedMedia } from './prune-media';
import { META_SHEET_NAME } from './meta-sheet';
import { allocateSheetNames, sheetNameKey } from './sheet-names';
import type { SheetScope } from './sheet-names';
import {
  applyFormulaResult,
  dropNamesOfRemovedSheets,
  toExactNumber,
  writeValue,
  EXCEL_CELL_TEXT_LIMIT,
} from './template-export';
import type { ExportField, TemplateExportOutcome } from './template-export';
import { formatFormula, parseFormula, rewriteSheetRefs } from '../engine/expr';
import { describeFormulaError } from '../engine/numfmt';
import type { FormulaErrorCode } from '../engine/numfmt';
import type { FormulaOutcome } from '../engine/grid-workbook';
import type { GridModel } from '../engine/grid-types';

/**
 * A manager's file: the report's own sheets, copied once for the totals and once
 * for every team, each copy filled in.
 *
 *  - A TEAM copy is the team's file as it exports on its own (G5a): its numbers
 *    in the input cells, its formulas kept — pointed at the copy of the SAME
 *    team, so a formula that names another sheet of the report never reads
 *    another team's numbers — with the figures worked out from that team's
 *    numbers as the cached result.
 *  - The TOTALS copy holds only constants: the aggregated numbers in the input
 *    cells and, where the template has a formula, the figure the SYSTEM
 *    reported for it (the one on the aggregate screen, frozen at close for a
 *    closed period). A formula left in the file would be recalculated by Excel
 *    on open, and Excel treats a team that did not report as a 0 where the
 *    system says "missing": the file and the screen would disagree (review
 *    OV5). A formula the system did not work out is blanked, not left to Excel.
 *
 * Runs in the bounded worker like the single-team export.
 */

export type PeriodScopeKind = 'TOTAL' | 'TEAM';

export interface PeriodExportScope extends SheetScope {
  kind: PeriodScopeKind;
  /** Field key → stored text (the aggregate for the totals, the team's own numbers otherwise); null/'' blank. */
  values: Record<string, string | null>;
}

export interface PeriodExportRequest {
  /** The report's sheets, in tab order. Every other sheet of the template is dropped. */
  selectedSheets: string[];
  fields: ExportField[];
  /** In file order: the totals first, then the teams. */
  scopes: PeriodExportScope[];
  grid: GridModel;
  /** "Sheet!A1" → the official figure of that formula, for the TOTAL scope; null when the system has none. */
  totalOutcomes: Record<string, FormulaOutcome> | null;
  /** Written to the hidden `__dr_meta` sheet (kind PERIOD, ids). */
  meta: Record<string, string>;
}

export interface PeriodExportOutcome extends TemplateExportOutcome {
  /** "Sheet!A1" of totals formulas the system had no figure for (written blank). */
  unresolvedTotals: string[];
  /** "Sheet!A1" of formulas whose sheet references could not be re-pointed (left as the template has them). */
  unrewritten: string[];
}

/** A file this large would not open comfortably, and building it would run the worker out of memory. */
export const PERIOD_EXPORT_MAX_SHEETS = 600;
export const PERIOD_EXPORT_MAX_CELLS = 3_000_000;

/** The template does something this export cannot reproduce faithfully; the caller falls back to a plain list. */
export class PeriodExportUnsupportedError extends Error {
  readonly code = 'EXPORT_UNSUPPORTED';
  constructor(message: string) {
    super(message);
    this.name = 'PeriodExportUnsupportedError';
  }
}

export class PeriodExportTooLargeError extends Error {
  readonly code = 'EXPORT_TOO_LARGE';
  constructor(message: string) {
    super(message);
    this.name = 'PeriodExportTooLargeError';
  }
}

function isFormulaValue(v: unknown): v is { formula?: string; sharedFormula?: string } {
  return !!v && typeof v === 'object' && !(v instanceof Date) && ('formula' in v || 'sharedFormula' in v);
}

function decodeAddress(address: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(address) as RegExpExecArray;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64;
  return { row: Number(m[2]), col };
}

/**
 * A copy of a sheet inside the same workbook: columns, rows, merges, views,
 * conditional formats, validations, page setup, pictures — everything exceljs
 * models — with the styles of every cell.
 *
 * exceljs reads `merges` but its setter wants `mergeCells`, and re-applying a
 * merge gives every covered cell the style of the block's first cell, which
 * drops the borders the file keeps on the covered cells; those are put back.
 */
function cloneSheet(workbook: ExcelJS.Workbook, source: ExcelJS.Worksheet, name: string): ExcelJS.Worksheet {
  const copy = workbook.addWorksheet(name);
  const model = structuredClone(source.model) as unknown as Record<string, unknown>;
  model.name = name;
  model.mergeCells = (source.model as unknown as { merges: string[] }).merges;
  (copy as unknown as { model: unknown }).model = model;
  for (const range of (source.model as unknown as { merges: string[] }).merges) {
    const [tl, br] = range.split(':');
    const a = decodeAddress(tl);
    const b = decodeAddress(br ?? tl);
    for (let r = a.row; r <= b.row; r++) {
      for (let c = a.col; c <= b.col; c++) {
        copy.getCell(r, c).style = structuredClone(source.getCell(r, c).style);
      }
    }
  }
  return copy;
}

/**
 * A reference to a sheet that is not part of the report. Dropped with the sheet, it must not be left naming it:
 * a team or total copy could carry the same name and the formula would quietly read that one. Excel's own
 * spelling of a reference to a deleted sheet is `#REF!`.
 */
const DANGLING_SHEET = '__dr_dangling__';

/**
 * The cells an array formula fills besides its first one hold only its last result — for a template, the
 * sample numbers of whoever made it. They are cleared (Excel fills them again when it recalculates) so no
 * viewer shows a stale number as if it were a result.
 */
function clearArrayResults(ws: ExcelJS.Worksheet): void {
  const ranges: Array<{ master: string; ref: string }> = [];
  ws.eachRow({ includeEmpty: false }, (row) =>
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value as unknown as { ref?: string; shareType?: string } | null;
      if (v && typeof v === 'object' && v.shareType === 'array' && typeof v.ref === 'string') {
        ranges.push({ master: cell.address, ref: v.ref });
      }
    }),
  );
  for (const { master, ref } of ranges) {
    const [tl, br] = ref.split(':');
    const a = decodeAddress(tl);
    const b = decodeAddress(br ?? tl);
    for (let r = a.row; r <= b.row; r++) {
      for (let c = a.col; c <= b.col; c++) {
        const cell = ws.getCell(r, c);
        if (cell.address !== master) cell.value = null;
      }
    }
  }
}

/** Re-points every explicit sheet name in the formulas of a copy at the copy of its own scope. */
function rewriteFormulas(
  copy: ExcelJS.Worksheet,
  original: string,
  rename: (sheet: string) => string,
  out: PeriodExportOutcome,
): void {
  copy.eachRow({ includeEmpty: false }, (row) =>
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value as unknown;
      if (!isFormulaValue(v) || typeof v.formula !== 'string') return;
      const parsed = parseFormula(v.formula);
      if (!parsed.ok) {
        if (v.formula.includes('!')) out.unrewritten.push(`${original}!${cell.address}`);
        return;
      }
      let dangling = false;
      const text = formatFormula(
        rewriteSheetRefs(parsed.expr, (sheet) => {
          const target = rename(sheet);
          if (target === DANGLING_SHEET) dangling = true;
          return target;
        }),
      ).split(`${DANGLING_SHEET}!`).join('#REF!');
      if (dangling) out.unrewritten.push(`${original}!${cell.address}`);
      if (text !== v.formula) cell.value = { ...(v as object), formula: text } as ExcelJS.CellValue;
    }),
  );
}

/** A formula's text without string literals and quoted sheet names, where a bare word can only be a name. */
function bareWords(formula: string): string {
  return formula.replace(/"(?:[^"]|"")*"/g, '""').replace(/'(?:[^']|'')*'/g, "''");
}

/**
 * Workbook-level names the formulas of the report use (`Amount*2`). The copies would lose the names the originals
 * had (a name points at ONE sheet, and the originals are replaced by one copy per scope), leaving `#NAME?` in every
 * team's file; the export says it cannot reproduce such a template rather than hand out a quietly broken one.
 */
function assertNoNamedRangesInUse(workbook: ExcelJS.Workbook, originals: ExcelJS.Worksheet[]): void {
  const model = (workbook.definedNames as unknown as { model?: Array<{ name: string }> }).model ?? [];
  const names = model.map((n) => n.name).filter((n) => n && !n.startsWith('_xlnm.'));
  if (names.length === 0) return;
  const pattern = new RegExp(
    `(?<![A-Za-z0-9_.!$'])(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![A-Za-z0-9_.(!'])`,
    'i',
  );
  for (const ws of originals) {
    let found: string | null = null;
    ws.eachRow({ includeEmpty: false }, (row) =>
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value as unknown;
        if (found || !isFormulaValue(v) || typeof v.formula !== 'string') return;
        if (pattern.test(bareWords(v.formula))) found = `${ws.name}!${cell.address}`;
      }),
    );
    if (found) {
      throw new PeriodExportUnsupportedError(
        `Mẫu dùng tên vùng (named range) trong công thức (${found}) — file tổng hợp theo mẫu chưa tái tạo được.`,
      );
    }
  }
}

/** What a totals cell shows in place of a formula: the figure the system reported, as a plain value. */
function constantOf(outcome: FormulaOutcome, key: string, scope: string, out: PeriodExportOutcome): ExcelJS.CellValue {
  if (!outcome.ok) {
    // "Missing" has no Excel error of its own and must not become a 0: say it.
    if (outcome.code === 'MISSING_DATA') return describeFormulaError('MISSING_DATA').text;
    return { error: describeFormulaError(outcome.code as FormulaErrorCode).text } as ExcelJS.CellValue;
  }
  if (outcome.type === 'boolean') return outcome.value;
  if (outcome.type === 'string') return outcome.value.slice(0, EXCEL_CELL_TEXT_LIMIT);
  const n = toExactNumber(outcome.value);
  if (n !== null) return n;
  out.textNumbers.push(`${scope}:${key}`);
  return outcome.value;
}

function blankFormulas(
  ws: ExcelJS.Worksheet,
  original: string,
  outcomes: Record<string, FormulaOutcome> | null,
  scope: string,
  out: PeriodExportOutcome,
): void {
  ws.eachRow({ includeEmpty: false }, (row) =>
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (!isFormulaValue(cell.value as unknown)) return;
      const key = `${original}!${cell.address}`;
      const outcome = outcomes?.[key];
      if (!outcome) {
        cell.value = null;
        out.unresolvedTotals.push(key);
        return;
      }
      cell.value = constantOf(outcome, key, scope, out);
    }),
  );
}

export async function buildPeriodWorkbook(
  template: Buffer | Uint8Array,
  request: PeriodExportRequest,
): Promise<{ buffer: Buffer; outcome: PeriodExportOutcome; names: Map<string, string> }> {
  const sheets = request.selectedSheets.filter((n) => n !== META_SHEET_NAME);
  const tooManySheets = request.scopes.length * sheets.length;
  const cellsPerScope = request.grid.sheets.reduce((n, s) => n + Object.keys(s.cells).length, 0);
  if (tooManySheets > PERIOD_EXPORT_MAX_SHEETS || cellsPerScope * request.scopes.length > PERIOD_EXPORT_MAX_CELLS) {
    throw new PeriodExportTooLargeError(
      `Báo cáo quá lớn để xuất thành một file (${request.scopes.length} phạm vi × ${sheets.length} sheet). Hãy xuất theo từng tổ.`,
    );
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(template as unknown as ExcelJS.Buffer);
  const date1904 = !!(workbook as unknown as { properties?: { date1904?: boolean } }).properties?.date1904;

  const present = sheets.filter((n) => workbook.getWorksheet(n));
  const keep = new Set(present);
  const removed = new Set<string>();
  for (const ws of [...workbook.worksheets]) {
    if (!keep.has(ws.name)) {
      removed.add(ws.name);
      workbook.removeWorksheet(ws.id);
    }
  }

  const outcome: PeriodExportOutcome = { textNumbers: [], truncated: [], unresolvedTotals: [], unrewritten: [] };
  const names = allocateSheetNames(request.scopes, present);
  const originals = present.map((n) => workbook.getWorksheet(n) as ExcelJS.Worksheet);
  assertNoNamedRangesInUse(workbook, originals);

  // Excel compares sheet names case-insensitively: `input!A1` names the sheet "Input".
  const canonical = new Map(present.map((n) => [n.toLowerCase(), n]));

  // Copies are taken from the untouched originals, before any number is written anywhere. They are made
  // under temporary names: a generated name (a team called like a template sheet — HSLN sheets ARE team
  // names) would collide with the original that is still there.
  const copies = new Map<string, ExcelJS.Worksheet>();
  let temporary = 0;
  for (const scope of request.scopes) {
    const rename = (sheet: string): string => {
      const original = canonical.get(sheet.toLowerCase());
      return (original && names.get(sheetNameKey(scope.scope, original))) || DANGLING_SHEET;
    };
    for (const original of originals) {
      const copy = cloneSheet(workbook, original, `__dr_tmp_${temporary++}`);
      clearArrayResults(copy);
      if (scope.kind === 'TEAM') rewriteFormulas(copy, original.name, rename, outcome);
      copies.set(sheetNameKey(scope.scope, original.name), copy);
    }
  }

  for (const original of originals) {
    removed.add(original.name);
    workbook.removeWorksheet(original.id);
  }
  dropNamesOfRemovedSheets(workbook, removed);
  for (const [key, copy] of copies) copy.name = names.get(key) as string;

  for (const ws of workbook.worksheets) {
    // exceljs writes print areas / titles of a sheet whose name has an apostrophe with broken quoting,
    // which makes Excel report the file as damaged. A missing print area is the lesser harm.
    if (ws.name.includes("'")) {
      ws.pageSetup.printArea = undefined as unknown as string;
      ws.pageSetup.printTitlesRow = undefined as unknown as string;
      ws.pageSetup.printTitlesColumn = undefined as unknown as string;
    }
  }

  for (const scope of request.scopes) {
    const scoped: TemplateExportOutcome = { textNumbers: [], truncated: [] };
    for (const field of request.fields) {
      const ws = copies.get(sheetNameKey(scope.scope, field.sheetKey));
      if (!ws) continue;
      writeValue(ws.getCell(field.address), field, scope.values[field.fieldKey] ?? null, date1904, scoped);
    }
    outcome.textNumbers.push(...scoped.textNumbers.map((k) => `${scope.scope}:${k}`));
    outcome.truncated.push(...scoped.truncated.map((k) => `${scope.scope}:${k}`));

    if (scope.kind === 'TOTAL') {
      for (const original of present) {
        const ws = copies.get(sheetNameKey(scope.scope, original)) as ExcelJS.Worksheet;
        blankFormulas(ws, original, request.totalOutcomes, scope.scope, outcome);
      }
    } else {
      const results = computeFormulaResults(request.grid, request.fields, scope.values);
      for (const [key, result] of Object.entries(results)) {
        const bang = key.lastIndexOf('!');
        const ws = copies.get(sheetNameKey(scope.scope, key.slice(0, bang)));
        if (ws) applyFormulaResult(ws.getCell(key.slice(bang + 1)), result);
      }
    }
  }

  // Excel and LibreOffice recalculate when they open the file (the team copies' formulas): the results
  // above are for viewers that do not.
  workbook.calcProperties = { ...(workbook.calcProperties ?? {}), fullCalcOnLoad: true };

  const meta = workbook.addWorksheet(META_SHEET_NAME, { state: 'veryHidden' });
  for (const [k, v] of Object.entries(request.meta)) meta.addRow([k, v]);
  // The table that tells any reader where each copy of each sheet went. A key per row: the reader maps
  // the first column to the second, so a repeated key would hide all but one.
  for (const [key, exported] of names) {
    const [scope, original] = key.split('\u0000');
    meta.addRow([`sheet|${scope}|${original}`, exported]);
  }
  for (const key of outcome.textNumbers) meta.addRow([`textNumber|${key}`, key]);
  for (const key of outcome.truncated) meta.addRow([`truncated|${key}`, key]);
  for (const key of outcome.unresolvedTotals) meta.addRow([`unresolvedTotal|${key}`, key]);
  for (const key of outcome.unrewritten) meta.addRow([`unrewritten|${key}`, key]);

  const written = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer: await pruneUnreferencedMedia(written), outcome, names };
}
