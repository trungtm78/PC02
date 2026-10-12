import * as ExcelJS from 'exceljs';
import Decimal from 'decimal.js';
import { computeFormulaResults } from './formula-results';
import type { FormulaResult } from './formula-results';
import { pruneUnreferencedMedia } from './prune-media';
import { META_SHEET_NAME } from './meta-sheet';
import type { GridModel } from '../engine/grid-types';

export type { FormulaResult } from './formula-results';

/**
 * The exported file IS the template: the original workbook is loaded, the
 * sheets the report does not use are dropped, the submitted values are written
 * into the input cells, and everything else — merged cells, borders, fills,
 * fonts, widths, number formats, frozen panes, the formulas themselves — is
 * left exactly as the author made it. An officer who opens it sees the form
 * they have always filled in, now filled in.
 *
 * Promises this module keeps:
 *  - what is written can be read back: a value exported from the system and
 *    imported again (S35) lands in the same cell with the same text;
 *  - a number is never silently rounded: past Excel's 15 significant digits it
 *    is written as text and listed in the metadata sheet;
 *  - nothing from a sheet that was dropped travels with the file (its pictures
 *    are pruned, names pointing at it are removed);
 *  - every formula carries a freshly worked-out result only when we are sure of
 *    it (see formula-results.ts); Excel and LibreOffice recalculate on open.
 *
 * It runs inside the bounded worker (see template/parse-worker.ts), calculation
 * included: a hostile or enormous workbook costs one thread, never the server.
 */

export type ExportFieldType = 'NUM' | 'TEXT' | 'DATE' | 'TIME';

export interface ExportField {
  sheetKey: string;
  address: string;
  fieldKey: string;
  type: ExportFieldType;
}

export interface TemplateExportRequest {
  /** Sheets that belong to the report, in tab order; every other sheet is removed. */
  selectedSheets: string[];
  fields: ExportField[];
  /** Field key → stored text (canonical number, ISO date, HH:mm, free text) or null for blank. */
  values: Record<string, string | null>;
  /** The render model: when given (and no explicit results), formula results are worked out in here. */
  grid?: GridModel;
  /** "Sheet!A1" → result of that formula cell. Overrides the calculation. */
  formulaResults?: Record<string, FormulaResult>;
  /** Written to the hidden metadata sheet, so an import can recognise (and refuse) a foreign file. */
  meta: Record<string, string>;
}

export { META_SHEET_NAME };
/** Excel keeps 15 significant digits of a number; more and it silently rounds. */
const EXCEL_SIGNIFICANT_DIGITS = 15;
/** The most characters one Excel cell can hold; more and Excel reports the file as damaged. */
export const EXCEL_CELL_TEXT_LIMIT = 32_767;

const DATE_FORMAT = 'dd/mm/yyyy';
const TIME_FORMAT = 'hh:mm';

/** True when an Excel number-format code shows a date or a time (not "General", "0.00", "@"…). */
export function isDateTimeFormat(code: string | undefined): boolean {
  if (!code) return false;
  // Ignore quoted literals and [colour]/[locale] sections, then look for a date/time letter.
  const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
  return /[dmyhs]/i.test(bare);
}

/** A number is written as a number only when Excel can hold it exactly. */
export function toExactNumber(text: string): number | null {
  let d: Decimal;
  try {
    d = new Decimal(text);
  } catch {
    return null;
  }
  if (!d.isFinite()) return null;
  if (d.precision(true) > EXCEL_SIGNIFICANT_DIGITS) return null;
  const n = d.toNumber();
  return new Decimal(n).eq(d) ? n : null;
}

function isoToUtcDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/**
 * A time of day as the Date exceljs turns into a fraction of a day. The
 * moment must be on day zero of the workbook's own calendar (30 Dec 1899, or
 * 1 Jan 1904 in a workbook that uses the 1904 system) or the serial comes out
 * negative and Excel arithmetic on it is wrong.
 */
function timeToDate(hhmm: string, date1904: boolean): Date | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return date1904
    ? new Date(Date.UTC(1904, 0, 1, Number(m[1]), Number(m[2])))
    : new Date(Date.UTC(1899, 11, 30, Number(m[1]), Number(m[2])));
}

export interface TemplateExportOutcome {
  /** Fields whose number could not be held exactly and were written as text. */
  textNumbers: string[];
  /** Fields whose text was longer than a cell can hold and was cut. */
  truncated: string[];
}

/** Writes one input value into its cell, keeping the cell's own look. */
function writeValue(
  cell: ExcelJS.Cell,
  field: ExportField,
  raw: string | null,
  date1904: boolean,
  out: TemplateExportOutcome,
): void {
  if (raw === null || raw === '') {
    cell.value = null;
    return;
  }
  switch (field.type) {
    case 'NUM': {
      const n = toExactNumber(raw);
      if (n === null) {
        cell.value = raw.length > EXCEL_CELL_TEXT_LIMIT ? raw.slice(0, EXCEL_CELL_TEXT_LIMIT) : raw;
        out.textNumbers.push(field.fieldKey);
      } else {
        cell.value = n;
        // A date format on a number cell would show (and read back) the number as a date.
        if (isDateTimeFormat(cell.numFmt)) cell.numFmt = 'General';
      }
      return;
    }
    case 'TEXT':
      // A string cell is text to Excel whatever it starts with; it is never a formula.
      if (raw.length > EXCEL_CELL_TEXT_LIMIT) {
        cell.value = raw.slice(0, EXCEL_CELL_TEXT_LIMIT);
        out.truncated.push(field.fieldKey);
      } else {
        cell.value = raw;
      }
      return;
    case 'DATE': {
      const d = isoToUtcDate(raw);
      if (!d) {
        cell.value = raw;
        return;
      }
      cell.value = d;
      // Without a date format the cell would show a bare serial number — and would not read back as a date.
      if (!isDateTimeFormat(cell.numFmt)) cell.numFmt = DATE_FORMAT;
      return;
    }
    case 'TIME': {
      const d = timeToDate(raw, date1904);
      if (!d) {
        cell.value = raw;
        return;
      }
      cell.value = d;
      if (!isDateTimeFormat(cell.numFmt)) cell.numFmt = TIME_FORMAT;
      return;
    }
  }
}

function applyFormulaResult(cell: ExcelJS.Cell, result: FormulaResult): void {
  const current = cell.value as unknown;
  if (!current || typeof current !== 'object') return;
  const holder = current as { formula?: string; sharedFormula?: string; result?: unknown };
  if (holder.formula === undefined && holder.sharedFormula === undefined) return;
  if (result.kind === 'none') {
    // The template's own cached value belongs to the template's sample numbers: drop it.
    const { result: _stale, ...rest } = holder;
    void _stale;
    cell.value = rest as ExcelJS.CellValue;
    return;
  }
  const resultValue: unknown = result.kind === 'error' ? { error: result.value } : result.value;
  cell.value = { ...(current as object), result: resultValue } as ExcelJS.CellValue;
}

/** Names that point into a sheet that is no longer in the file would dangle. */
function dropNamesOfRemovedSheets(workbook: ExcelJS.Workbook, removed: ReadonlySet<string>): void {
  const names = workbook.definedNames as unknown as {
    forEach(cb: (name: string, cell: { sheetName?: string }) => void): void;
    removeEx(location: unknown, name: string): void;
  };
  const doomed: Array<{ name: string; cell: { sheetName?: string } }> = [];
  names.forEach((name, cell) => {
    if (cell.sheetName && removed.has(cell.sheetName)) doomed.push({ name, cell });
  });
  for (const { name, cell } of doomed) names.removeEx(cell, name);
}

export async function buildTemplateWorkbook(
  template: Buffer | Uint8Array,
  request: TemplateExportRequest,
): Promise<{ buffer: Buffer; outcome: TemplateExportOutcome }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(template as unknown as ExcelJS.Buffer);
  const date1904 = !!(workbook as unknown as { properties?: { date1904?: boolean } }).properties?.date1904;

  // Our own identity sheet is never part of the report — not even if a previous export is used as the template.
  const keep = new Set(request.selectedSheets.filter((n) => n !== META_SHEET_NAME));
  const removed = new Set<string>();
  for (const ws of [...workbook.worksheets]) {
    if (!keep.has(ws.name)) {
      removed.add(ws.name);
      workbook.removeWorksheet(ws.id);
    }
  }
  dropNamesOfRemovedSheets(workbook, removed);

  for (const ws of workbook.worksheets) {
    // exceljs writes print areas / titles of a sheet whose name has an apostrophe with broken quoting,
    // which makes Excel report the file as damaged. A missing print area is the lesser harm.
    if (ws.name.includes("'")) {
      ws.pageSetup.printArea = undefined as unknown as string;
      ws.pageSetup.printTitlesRow = undefined as unknown as string;
      ws.pageSetup.printTitlesColumn = undefined as unknown as string;
    }
  }

  const outcome: TemplateExportOutcome = { textNumbers: [], truncated: [] };

  for (const field of request.fields) {
    const ws = workbook.getWorksheet(field.sheetKey);
    if (!ws) continue;
    writeValue(ws.getCell(field.address), field, request.values[field.fieldKey] ?? null, date1904, outcome);
  }

  const formulaResults =
    request.formulaResults ??
    (request.grid ? computeFormulaResults(request.grid, request.fields, request.values) : {});
  for (const [key, result] of Object.entries(formulaResults)) {
    const bang = key.lastIndexOf('!');
    const ws = workbook.getWorksheet(key.slice(0, bang));
    if (!ws) continue;
    applyFormulaResult(ws.getCell(key.slice(bang + 1)), result);
  }

  // Excel and LibreOffice recalculate when they open the file: the results above are for viewers that do not.
  workbook.calcProperties = { ...(workbook.calcProperties ?? {}), fullCalcOnLoad: true };

  // (A sheet already called __dr_meta was dropped above with every other sheet the report does not list.)
  const meta = workbook.addWorksheet(META_SHEET_NAME, { state: 'veryHidden' });
  for (const [k, v] of Object.entries(request.meta)) meta.addRow([k, v]);
  // One row each: a long list in a single cell could itself pass the cell limit.
  for (const key of outcome.textNumbers) meta.addRow(['textNumber', key]);
  for (const key of outcome.truncated) meta.addRow(['truncated', key]);

  const written = Buffer.from(await workbook.xlsx.writeBuffer());
  const buffer = removed.size > 0 ? await pruneUnreferencedMedia(written) : written;
  return { buffer, outcome };
}

/** The identity an exported file carries, or null for a file that was not produced by an export. */
export function readExportMeta(workbook: ExcelJS.Workbook): Record<string, string> | null {
  const sheet = workbook.getWorksheet(META_SHEET_NAME);
  if (!sheet) return null;
  const out: Record<string, string> = {};
  sheet.eachRow((row) => {
    const key = row.getCell(1).value;
    const value = row.getCell(2).value;
    if (typeof key === 'string' && (typeof value === 'string' || typeof value === 'number')) out[key] = String(value);
  });
  return out;
}
