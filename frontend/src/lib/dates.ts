/**
 * Date helpers for form pre-fill and `<input type="date">` binding.
 *
 * Use local-TZ formatting (NOT `toISOString().split('T')[0]`). Vietnam is UTC+07,
 * so `new Date().toISOString()` at 22:00 local on 2026-05-09 returns
 * `2026-05-09T15:00:00Z`. After 17:00 UTC (00:00 local next day), the UTC date
 * shifts but the user is still on the previous local date — defaulting to UTC
 * silently shows yesterday in `<input type="date">`.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Returns today in local timezone as `YYYY-MM-DD` (suitable for <input type="date">). */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Normalizes a date-like value to `YYYY-MM-DD` in local timezone.
 * - `Date` instance → formatted string
 * - ISO 8601 string (with or without time) → formatted string
 * - `null`, `undefined`, empty string → `''`
 * - Invalid string → `''`
 *
 * Use for binding existing record dates to `<input type="date">`.
 */
export function toDateInput(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
