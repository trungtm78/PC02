import { PROCESSING_ERROR } from '../contract/processing-codes';
import {
  civilDayFromParts,
  civilDayOf,
  civilDayParts,
  civilYearOf,
  daysInMonth,
  endOfCivilDay,
  MS_PER_HOUR,
  type CivilDay,
} from './civil-day';
import { ProcessingEngineError } from './errors';
import type { DurationUnit } from './types';
import type { WorkingCalendar } from './working-calendar';

/** The largest duration accepted, in any unit: a mistyped figure must not send a deadline centuries away. */
export const MAX_DURATION_VALUE = 36_500;

/**
 * How far the search for a working day goes before the calendar is declared broken. Longer than any real run of days
 * off, short enough to stop a calendar in which no day works.
 */
const MAX_DAYS_WITHOUT_A_WORKING_DAY = 366;

export interface ComputeDueInput {
  /** The date the duration is counted from. `hasTime: false`: only its calendar day means something. */
  anchor: { at: Date; hasTime: boolean };
  /** A whole number, 0 or more. */
  value: number;
  unit: DurationUnit;
  /** For DAY and MONTH: a last day that is not a working day moves to the next working day. */
  rollToWorkingDay: boolean;
  calendar: WorkingCalendar;
}

export interface ComputeDueResult {
  dueAt: Date;
  /** The result leaned on the calendar of a year nobody has confirmed: it may move when that year is completed. */
  provisional: boolean;
  /** The version of the calendar the result was read from; `null` when no day of the calendar was looked at. */
  calendarVersion: string | null;
}

/**
 * The deadline of a step. Vietnam time (UTC+7, no daylight saving). No clock and no database: the same input always
 * gives the same answer.
 *
 * - DAY: the anchor's civil day is NOT counted. The deadline is the END (23:59:59.999 +07:00) of the civil day
 *   `value` days after the anchor's day. Value 0: the end of the anchor's day.
 * - MONTH: the same day of month `value` months later; when that month has no such day, its last day (31 January + 1
 *   month = 28 or 29 February). The day of month always comes from the anchor, never from a shortened month in
 *   between. The END of that civil day.
 * - WORKING_DAY: the `value`-th working day AFTER the anchor's civil day; the END of that civil day. Value 0: the
 *   anchor's day when it is a working day, otherwise the next working day (so the result is always a working day).
 * - HOUR: the anchor instant plus `value` hours, to the millisecond. The anchor must carry a time of day
 *   (`HOUR_ANCHOR_HAS_NO_TIME` otherwise). Hours run through nights, weekends and holidays; `rollToWorkingDay` is
 *   ignored and the calendar is never looked at.
 * - `rollToWorkingDay` (DAY and MONTH only): when the last day is not a working day, the deadline is the END of the
 *   next working day.
 *
 * `provisional` is true when any civil day the calendar was asked about (while counting working days, or while
 * checking whether to roll, even when the day stayed) lies in a year that is not confirmed.
 */
export function computeDue(input: ComputeDueInput): ComputeDueResult {
  const { anchor, value, unit } = input;
  if (!(anchor.at instanceof Date) || Number.isNaN(anchor.at.getTime())) throw new ProcessingEngineError(PROCESSING_ERROR.ANCHOR_INVALID);
  if (!Number.isInteger(value) || value < 0 || value > MAX_DURATION_VALUE) throw new ProcessingEngineError(PROCESSING_ERROR.DURATION_INVALID);

  if (unit === 'HOUR') {
    if (!anchor.hasTime) throw new ProcessingEngineError(PROCESSING_ERROR.HOUR_ANCHOR_HAS_NO_TIME);
    return { dueAt: new Date(anchor.at.getTime() + value * MS_PER_HOUR), provisional: false, calendarVersion: null };
  }

  const watched = watch(input.calendar);
  const anchorDay = civilDayOf(anchor.at);
  let lastDay: CivilDay;
  if (unit === 'WORKING_DAY') {
    lastDay = value === 0 ? nextWorkingDayFrom(anchorDay, watched.isWorkingDay) : addWorkingDays(anchorDay, value, watched.isWorkingDay);
  } else {
    lastDay = unit === 'DAY' ? anchorDay + value : addMonths(anchorDay, value);
    if (input.rollToWorkingDay) lastDay = nextWorkingDayFrom(lastDay, watched.isWorkingDay);
  }

  return {
    dueAt: endOfCivilDay(lastDay),
    provisional: watched.years().some((year) => !input.calendar.isConfirmed(year)),
    calendarVersion: watched.years().length > 0 ? input.calendar.version : null,
  };
}

/** The calendar, remembering the years of the days it was asked about. */
function watch(calendar: WorkingCalendar) {
  const years = new Set<number>();
  return {
    isWorkingDay: (day: CivilDay): boolean => {
      years.add(civilYearOf(day));
      return calendar.isWorkingDay(day);
    },
    years: () => [...years],
  };
}

type IsWorkingDay = (day: CivilDay) => boolean;

/** The day itself when it is a working day, otherwise the first working day after it. */
function nextWorkingDayFrom(day: CivilDay, isWorkingDay: IsWorkingDay): CivilDay {
  for (let tried = 0; tried <= MAX_DAYS_WITHOUT_A_WORKING_DAY; tried++) {
    if (isWorkingDay(day + tried)) return day + tried;
  }
  throw new ProcessingEngineError(PROCESSING_ERROR.CALENDAR_HAS_NO_WORKING_DAY);
}

/** The `count`-th working day strictly after `day` (count >= 1). */
function addWorkingDays(day: CivilDay, count: number, isWorkingDay: IsWorkingDay): CivilDay {
  let current = day;
  for (let counted = 0; counted < count; counted++) current = nextWorkingDayFrom(current + 1, isWorkingDay);
  return current;
}

/** The same day of month `months` later, or the last day of that month when it is shorter. */
function addMonths(day: CivilDay, months: number): CivilDay {
  const from = civilDayParts(day);
  const index = from.year * 12 + (from.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return civilDayFromParts(year, month, Math.min(from.day, daysInMonth(year, month)));
}
