/**
 * The Vietnam civil day, as arithmetic.
 *
 * Vietnam is UTC+7 all year (no daylight saving), so the civil day of an instant is a division, and nothing here asks
 * the process for its time zone: no local-time `Date` method is used, only epoch milliseconds and the UTC getters on a
 * shifted value. The results are the same under any `TZ`.
 *
 * A date COLUMN (a calendar day stored at 00:00 UTC) is 07:00 of that same day in Vietnam, so its civil day is the day
 * that was entered.
 */

/** A civil day in Vietnam: the number of days from 1970-01-01 to that calendar date. */
export type CivilDay = number;

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
const VIETNAM_OFFSET_MS = 7 * MS_PER_HOUR;

/** The civil day in Vietnam that contains this instant. `NaN` for an invalid date. */
export function civilDayOf(instant: Date): CivilDay {
  return Math.floor((instant.getTime() + VIETNAM_OFFSET_MS) / MS_PER_DAY);
}

/** 00:00:00.000 +07:00 of the day. */
export function startOfCivilDay(day: CivilDay): Date {
  return new Date(day * MS_PER_DAY - VIETNAM_OFFSET_MS);
}

/** 23:59:59.999 +07:00 of the day. */
export function endOfCivilDay(day: CivilDay): Date {
  return new Date((day + 1) * MS_PER_DAY - VIETNAM_OFFSET_MS - 1);
}

export interface CivilDayParts {
  year: number;
  /** 1..12 */
  month: number;
  /** 1..31 */
  day: number;
  /** JavaScript weekday number: 0 = Sunday, 1 = Monday, ... 6 = Saturday. */
  weekday: number;
}

export function civilDayParts(day: CivilDay): CivilDayParts {
  const date = new Date(day * MS_PER_DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), weekday: date.getUTCDay() };
}

export function civilYearOf(day: CivilDay): number {
  return new Date(day * MS_PER_DAY).getUTCFullYear();
}

/** The civil day of a calendar date. Overflowing parts are NOT normalised away: the caller passes a real date. */
export function civilDayFromParts(year: number, month: number, day: number): CivilDay {
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/** How many days the month has (month 1..12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` to a civil day; `NaN` when the text is not a date that exists. */
export function civilDayFromIso(text: string): CivilDay {
  const match = ISO_DAY.exec(text);
  if (!match) return Number.NaN;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return Number.NaN;
  return civilDayFromParts(year, month, day);
}

/** A civil day as `YYYY-MM-DD`. */
export function civilDayToIso(day: CivilDay): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}
