import * as ExcelJS from 'exceljs';
import Decimal from 'decimal.js';

/**
 * The exported file IS the template: the original workbook is loaded, the
 * sheets the report does not use are dropped, the submitted values are written
 * into the input cells, and everything else — merged cells, borders, fills,
 * fonts, widths, number formats, frozen panes, the formulas themselves — is
 * left exactly as the author made it. An officer who opens it sees the form
 * they have always filled in, now filled in.
 *
 * Three promises this module keeps:
 *  - what is written can be read back: a value exported from the system and
 *    imported again (S35) lands in the same cell with the same text;
 *  - a number is never silently rounded: past Excel's 15 significant digits it
 *    is written as text and listed in the metadata sheet;
 *  - every formula carries a freshly worked-out result (the same calculation
 *    the screen uses), so a viewer that does not recalculate — a phone's file
 *    preview, a mail client — still shows the right figures. Excel and
 *    LibreOffice recalculate on open anyway.
 *
 * It runs inside the bounded worker (see template/parse-worker.ts): a hostile
 * or enormous workbook costs one thread, never the server.
 */

export type ExportFieldType = 'NUM' | 'TEXT' | 'DATE' | 'TIME';

export interface ExportField {
  sheetKey: string;
  address: string;
  fieldKey: string;
  type: ExportFieldType;
}

/** The result of one formula, already worked out; `error` carries Excel's own literal ("#DIV/0!"). */
export type FormulaResult =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'error'; value: string };

export interface TemplateExportRequest {
  /** Sheets that belong to the report, in tab order; every other sheet is removed. */
  selectedSheets: string[];
  fields: ExportField[];
  /** Field key → stored text (canonical number, ISO date, HH:mm, free text) or null for blank. */
  values: Record<string, string | null>;
  /** "Sheet!A1" → result of that formula cell. */
  formulaResults: Record<string, FormulaResult>;
  /** Written to the hidden metadata sheet, so an import can recognise (and refuse) a foreign file. */
  meta: Record<string, string>;
}

export const META_SHEET_NAME = '__dr_meta';
/** Excel keeps 15 significant digits of a number; more and it silently rounds. */
const EXCEL_SIGNIFICANT_DIGITS = 15;

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

function timeToDate(hhmm: string): Date | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  // ExcelJS reads a time-formatted cell back as a Date on 1899-12-30 (UTC): write the same moment.
  return new Date(Date.UTC(1899, 11, 30, Number(m[1]), Number(m[2])));
}

export interface TemplateExportOutcome {
  /** Fields whose number could not be held exactly and were written as text. */
  textNumbers: string[];
}

/** Writes one input value into its cell, keeping the cell's own look. */
function writeValue(cell: ExcelJS.Cell, field: ExportField, raw: string | null, out: TemplateExportOutcome): void {
  if (raw === null || raw === '') {
    cell.value = null;
    return;
  }
  switch (field.type) {
    case 'NUM': {
      const n = toExactNumber(raw);
      if (n === null) {
        cell.value = raw;
        out.textNumbers.push(field.fieldKey);
      } else {
        cell.value = n;
      }
      return;
    }
    case 'TEXT':
      // A string cell is text to Excel whatever it starts with; it is never a formula.
      cell.value = raw;
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
      const d = timeToDate(raw);
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
  const holder = current as { formula?: string; sharedFormula?: string };
  if (holder.formula === undefined && holder.sharedFormula === undefined) return;
  const resultValue: unknown = result.kind === 'error' ? { error: result.value } : result.value;
  cell.value = { ...(current as object), result: resultValue } as ExcelJS.CellValue;
}

export async function buildTemplateWorkbook(
  template: Buffer | Uint8Array,
  request: TemplateExportRequest,
): Promise<{ buffer: Buffer; outcome: TemplateExportOutcome }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(template as unknown as ExcelJS.Buffer);

  const keep = new Set(request.selectedSheets);
  for (const ws of [...workbook.worksheets]) {
    if (!keep.has(ws.name)) workbook.removeWorksheet(ws.id);
  }

  const outcome: TemplateExportOutcome = { textNumbers: [] };

  for (const field of request.fields) {
    const ws = workbook.getWorksheet(field.sheetKey);
    if (!ws) continue;
    writeValue(ws.getCell(field.address), field, request.values[field.fieldKey] ?? null, outcome);
  }

  for (const [key, result] of Object.entries(request.formulaResults)) {
    const bang = key.lastIndexOf('!');
    const ws = workbook.getWorksheet(key.slice(0, bang));
    if (!ws) continue;
    applyFormulaResult(ws.getCell(key.slice(bang + 1)), result);
  }

  // Excel and LibreOffice recalculate when they open the file: the results above are for viewers that do not.
  workbook.calcProperties = { ...(workbook.calcProperties ?? {}), fullCalcOnLoad: true };

  const meta = workbook.addWorksheet(META_SHEET_NAME, { state: 'veryHidden' });
  for (const [k, v] of Object.entries(request.meta)) meta.addRow([k, v]);
  if (outcome.textNumbers.length > 0) meta.addRow(['textNumbers', outcome.textNumbers.join(',')]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
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
