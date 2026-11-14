import { createHash } from 'node:crypto';
import { CALENDAR_DAY_KINDS, PROCESSING_ERROR } from '../contract/processing-codes';
import { civilDayFromIso, civilDayParts, civilYearOf, type CivilDay } from './civil-day';
import { ProcessingEngineError } from './errors';
import type { CalendarDayKind, CalendarYearStatus } from './types';

/**
 * Which days are working days, as the deadline engine sees it. Pure: built from data, asks no database and no clock.
 */
export interface WorkingCalendar {
  /** Whether the civil day (Vietnam) is a working day. */
  isWorkingDay(day: CivilDay): boolean;
  /** Whether a person has confirmed that the days of this year are complete. A year with no data is not. */
  isConfirmed(year: number): boolean;
  /** A stable hash of the years and days held: the same data gives the same version, any change a different one. */
  readonly version: string;
}

/** Saturday and Sunday, in JavaScript weekday numbers (0 = Sunday ... 6 = Saturday). */
export const DEFAULT_WEEKEND_DAYS: readonly number[] = Object.freeze([6, 0]);

export const MIN_CALENDAR_YEAR = 1900;
export const MAX_CALENDAR_YEAR = 9999;

export interface WorkingCalendarDayData {
  /** `YYYY-MM-DD`, a day of the year it is listed under. */
  date: string;
  /** `OFF`: a day off. `WORKING`: a working day in spite of the weekend (a compensatory day). */
  kind: CalendarDayKind;
  label?: string | null;
}

export interface WorkingCalendarYearData {
  year: number;
  /** Weekday numbers that are off every week: JavaScript numbering, 0 = Sunday ... 6 = Saturday. */
  weekendDays: readonly number[];
  status: CalendarYearStatus;
  days: readonly WorkingCalendarDayData[];
}

/**
 * Refuses a year that cannot be a calendar: a year out of range, weekday numbers outside 0..6 or repeated, a week with
 * no working day at all, a day that is not a date of THAT year, a day listed twice, an unknown kind.
 */
export function checkCalendarYear(data: Pick<WorkingCalendarYearData, 'year' | 'weekendDays' | 'days'>): void {
  if (!Number.isInteger(data.year) || data.year < MIN_CALENDAR_YEAR || data.year > MAX_CALENDAR_YEAR) {
    throw new ProcessingEngineError(PROCESSING_ERROR.CALENDAR_YEAR_INVALID);
  }
  const weekend = data.weekendDays;
  const weekendOk =
    Array.isArray(weekend) &&
    weekend.every((n) => Number.isInteger(n) && n >= 0 && n <= 6) &&
    new Set(weekend).size === weekend.length &&
    weekend.length < 7;
  if (!weekendOk) throw new ProcessingEngineError(PROCESSING_ERROR.CALENDAR_WEEKEND_INVALID);

  const seen = new Set<string>();
  for (const day of data.days) {
    const civil = typeof day?.date === 'string' ? civilDayFromIso(day.date) : Number.NaN;
    const ok =
      !Number.isNaN(civil) &&
      civilYearOf(civil) === data.year &&
      !seen.has(day.date) &&
      (CALENDAR_DAY_KINDS as readonly string[]).includes(day.kind);
    if (!ok) throw new ProcessingEngineError(PROCESSING_ERROR.CALENDAR_DAY_INVALID);
    seen.add(day.date);
  }
}

/**
 * The working calendar of the years given.
 *
 * A day is a working day when it is listed `WORKING`; it is not when it is listed `OFF`; otherwise it is unless its
 * weekday is one of the year's weekend days. A year that is not given behaves as: the default weekend off, no
 * holidays, NOT confirmed.
 */
export function buildWorkingCalendar(years: readonly WorkingCalendarYearData[]): WorkingCalendar {
  const byYear = new Map<number, { weekend: ReadonlySet<number>; confirmed: boolean; days: ReadonlyMap<CivilDay, CalendarDayKind> }>();
  for (const data of years) {
    checkCalendarYear(data);
    if (byYear.has(data.year)) throw new ProcessingEngineError(PROCESSING_ERROR.CALENDAR_YEAR_INVALID);
    byYear.set(data.year, {
      weekend: new Set(data.weekendDays),
      confirmed: data.status === 'CONFIRMED',
      days: new Map(data.days.map((day) => [civilDayFromIso(day.date), day.kind])),
    });
  }
  const defaultWeekend: ReadonlySet<number> = new Set(DEFAULT_WEEKEND_DAYS);

  return {
    isWorkingDay(day) {
      const { year, weekday } = civilDayParts(day);
      const held = byYear.get(year);
      const listed = held?.days.get(day);
      if (listed !== undefined) return listed === 'WORKING';
      return !(held?.weekend ?? defaultWeekend).has(weekday);
    },
    isConfirmed: (year) => byYear.get(year)?.confirmed === true,
    version: versionOf(years),
  };
}

/** SHA-256 of the data in one fixed order. Labels are not part of it: they do not change any deadline. */
function versionOf(years: readonly WorkingCalendarYearData[]): string {
  const canonical = [...years]
    .sort((a, b) => a.year - b.year)
    .map((data) => [
      data.year,
      data.status,
      [...data.weekendDays].sort((a, b) => a - b),
      [...data.days].map((day) => `${day.date}:${day.kind}`).sort(),
    ]);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
