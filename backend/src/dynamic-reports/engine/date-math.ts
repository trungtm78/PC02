/**
 * Shared calendar-date arithmetic used by both `values.ts` (DATE field
 * validation) and `period.ts` (schedule/period generation). Pure, no I/O
 * (spec §10 R2). All functions operate on plain (year, month, day) integers
 * — never on a JS `Date` read back in the runtime's local timezone, which
 * is exactly the bug class FRD §4.4 warns against ("không đổi ngày vì
 * timezone"). `Date.UTC` is used only as an internal calculation aid here,
 * never to represent a parsed value.
 */

/** Days in `month` (1-12) of `year`, accounting for leap years. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function isoDateOnly(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

/** Clamps `day` to the last valid day of (year, month) — FRD §5/D08: "ngày 29-31 không tồn tại thì lấy ngày cuối tháng". Returns the clamped day and whether clamping occurred. */
export function clampDayToMonthEnd(
  year: number,
  month: number,
  day: number,
): { day: number; clamped: boolean } {
  const last = daysInMonth(year, month);
  return day > last ? { day: last, clamped: true } : { day, clamped: false };
}

/** Days since the Unix epoch for a plain calendar date, using UTC arithmetic only as a day-counting device (not a represented instant). */
function epochDay(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** Adds `days` (may be negative) to a plain calendar date. */
export function addDays(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/** 1 (Monday) .. 7 (Sunday), ISO 8601 day-of-week. */
export function isoWeekday(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 7 : jsDay;
}

export interface IsoWeekInfo {
  isoYear: number;
  isoWeek: number;
}

/**
 * ISO 8601 week-date (week-year, week number). The ISO week-year can differ
 * from the calendar year at the boundary — e.g. 2026-12-31 may fall in ISO
 * week 1 of 2027, and 2027-01-01 may still fall in ISO week 53 of 2026.
 * Algorithm: the Thursday of the same ISO week always has the correct
 * calendar year, and that year's week count follows from the day-of-year
 * of that Thursday.
 */
export function isoWeekInfo(
  year: number,
  month: number,
  day: number,
): IsoWeekInfo {
  const weekday = isoWeekday(year, month, day); // 1..7
  const thursday = addDays(year, month, day, 4 - weekday);
  const isoYear = thursday.year;
  const jan1Epoch = epochDay(isoYear, 1, 1);
  const thursdayEpoch = epochDay(thursday.year, thursday.month, thursday.day);
  const isoWeek = Math.floor((thursdayEpoch - jan1Epoch) / 7) + 1;
  return { isoYear, isoWeek };
}

/** Monday of ISO week `isoWeek` in `isoYear`. */
export function isoWeekMonday(
  isoYear: number,
  isoWeek: number,
): { year: number; month: number; day: number } {
  // Jan 4 is always in week 1 of its ISO year.
  const jan4Weekday = isoWeekday(isoYear, 1, 4);
  const week1Monday = addDays(isoYear, 1, 4, 1 - jan4Weekday);
  return addDays(
    week1Monday.year,
    week1Monday.month,
    week1Monday.day,
    (isoWeek - 1) * 7,
  );
}

export const QUARTER_FIRST_MONTH = [
  1, 1, 1, 4, 4, 4, 7, 7, 7, 10, 10, 10,
] as const; // index = month-1
export function quarterOfMonth(month: number): 1 | 2 | 3 | 4 {
  return (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}
