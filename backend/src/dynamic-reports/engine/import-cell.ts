/**
 * S35 (PR6 slice 8) — converts one literal Excel cell value into the raw
 * string `engine/values.ts#validateFieldValue` expects, per field type.
 * Pure (spec §10 R2): takes a plain `{ value: unknown }` shape (matching
 * ExcelJS's own `Cell`, but never imports ExcelJS itself), so it is
 * trivially unit-testable without constructing a real worksheet.
 *
 * Deliberately does NOT reinterpret ambiguous numeric-vs-date cases: a
 * NUM field reads a Date-typed cell as "không đọc được" (never silently
 * treats an Excel date serial as a plain number), matching `values.ts`'s
 * own documented boundary ("không tự động chuyển đổi số ngày Excel").
 */

export type ImportCellType = 'NUM' | 'TEXT' | 'DATE' | 'TIME';

interface CellLike {
  value: unknown;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** ExcelJS returns date/time cells as JS `Date` built from UTC components — read them back the same way to dodge any local-timezone shift. */
function formatDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function formatTimeUtc(d: Date): string {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** Unwraps exceljs's `{formula, result}` shape for a formula cell; returns the raw value otherwise. */
function resolveFormulaResult(value: unknown): unknown {
  if (value && typeof value === 'object' && 'result' in value) {
    return (value as { result: unknown }).result;
  }
  return value;
}

/**
 * Returns the raw string for `validateFieldValue`, or `null` for a blank
 * cell. Returns `undefined` when the cell's value cannot be read as the
 * requested type at all (e.g. a DATE field whose cell holds free text) —
 * the caller surfaces this as a validation error, never silently guesses.
 */
export function readImportCellRaw(
  cell: CellLike,
  type: ImportCellType,
): string | null | undefined {
  const raw = resolveFormulaResult(cell.value);
  if (raw === null || raw === undefined || raw === '') return null;

  switch (type) {
    case 'NUM': {
      if (typeof raw === 'number') return String(raw);
      if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
      return undefined;
    }
    case 'TEXT': {
      if (typeof raw === 'string') return raw;
      if (typeof raw === 'number') return String(raw);
      return undefined;
    }
    case 'DATE': {
      if (raw instanceof Date) return formatDateUtc(raw);
      if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
      return undefined;
    }
    case 'TIME': {
      if (raw instanceof Date) return formatTimeUtc(raw);
      if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
      return undefined;
    }
  }
}
