/**
 * Date helpers for form pre-fill and `<input type="date">` binding.
 *
 * Use Vietnam timezone (Asia/Ho_Chi_Minh, UTC+7, no DST) for all display.
 * `toLocaleString("vi-VN")` without timeZone uses browser OS timezone — on UTC
 * machines this shows times 7 hours wrong. All helpers here explicitly pin to VN.
 */

const VN_TZ = 'Asia/Ho_Chi_Minh';

// en-CA locale produces YYYY-MM-DD; stable convention across V8/SpiderMonkey/JSC since 2015.
// Not ECMAScript-spec-guaranteed but universally implemented.
function toVNDateString(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: VN_TZ });
}

/** Returns today in Vietnam timezone as `YYYY-MM-DD` (suitable for <input type="date">). */
export function today(): string {
  return toVNDateString(new Date());
}

/**
 * Normalizes a date-like value to `YYYY-MM-DD` in Vietnam timezone.
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
  return toVNDateString(d);
}

/**
 * Formats a UTC timestamp as Vietnam local datetime: "25/05/2026 19:01:34"
 * Always uses Asia/Ho_Chi_Minh regardless of browser OS timezone.
 * Returns '—' for null/undefined/invalid (use '' for form inputs — see toDateInput).
 */
export function formatVNDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    timeZone: VN_TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

/**
 * Formats a UTC timestamp as Vietnam local date: "25/05/2026"
 * Returns '—' for null/undefined/invalid.
 */
export function formatVNDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    timeZone: VN_TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/**
 * Formats a UTC timestamp as Vietnam local time: "19:01"
 * Returns '—' for null/undefined/invalid.
 */
export function formatVNTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('vi-VN', {
    timeZone: VN_TZ,
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}
