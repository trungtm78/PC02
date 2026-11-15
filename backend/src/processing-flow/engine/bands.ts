import { BANDS, PROCESSING_ERROR } from '../contract/processing-codes';
import { civilDayOf, endOfCivilDay, startOfCivilDay } from './civil-day';
import { ProcessingEngineError } from './errors';
import type { Band, CompletionClass } from './types';

/** The alert thresholds of a step, in REMAINING civil days. 0 <= red <= yellow <= green. */
export interface Thresholds {
  redDays: number;
  yellowDays: number;
  greenDays: number;
}

/** Whole numbers with 0 <= red <= yellow <= green; anything else is `THRESHOLDS_NOT_ASCENDING`. */
export function validateThresholds(t: Thresholds): void {
  const values = [t.redDays, t.yellowDays, t.greenDays];
  const ok = values.every((n) => Number.isInteger(n) && n >= 0) && t.redDays <= t.yellowDays && t.yellowDays <= t.greenDays;
  if (!ok) throw new ProcessingEngineError(PROCESSING_ERROR.THRESHOLDS_NOT_ASCENDING);
}

/**
 * Civil days left: the civil day (Vietnam) of the deadline minus the civil day of now. 0 on the due day, negative from
 * the day after it.
 *
 * It counts DAYS, not time: for a deadline in the middle of a day (hours) it is still 0 after that hour on the due
 * day. Whether a deadline has passed is `bandOf(...) === 'OVERDUE'` (now later than the deadline), never this number.
 */
export function remainingDays(now: Date, dueAt: Date): number {
  return civilDayOf(dueAt) - civilDayOf(now);
}

export interface BandInstants {
  greenFrom: Date;
  yellowFrom: Date;
  redFrom: Date;
}

/**
 * The instants at which a deadline enters each band: the first millisecond (00:00:00.000 +07:00) of the civil day
 * (due day - threshold). Stored next to the deadline, they let a query find a band without computing per row.
 */
export function bandInstants(dueAt: Date, t: Thresholds): BandInstants {
  validateThresholds(t);
  const dueDay = civilDayOf(dueAt);
  return {
    greenFrom: startOfCivilDay(dueDay - t.greenDays),
    yellowFrom: startOfCivilDay(dueDay - t.yellowDays),
    redFrom: startOfCivilDay(dueDay - t.redDays),
  };
}

/**
 * The band of a deadline at `now`: later than the deadline is OVERDUE (exactly at it is not); otherwise by remaining
 * civil days: <= red is RED, <= yellow is YELLOW, <= green is GREEN, more is NONE.
 */
export function bandOf(now: Date, dueAt: Date, t: Thresholds): Band {
  validateThresholds(t);
  if (now.getTime() > dueAt.getTime()) return 'OVERDUE';
  const remaining = remainingDays(now, dueAt);
  if (remaining <= t.redDays) return 'RED';
  if (remaining <= t.yellowDays) return 'YELLOW';
  if (remaining <= t.greenDays) return 'GREEN';
  return 'NONE';
}

/** The more urgent of two bands: OVERDUE, then RED, YELLOW, GREEN, NONE. */
export function worseBand(a: Band, b: Band): Band {
  return BANDS.indexOf(a) <= BANDS.indexOf(b) ? a : b;
}

/** The four stored instants of a deadline. */
export interface BandRow {
  dueAt: Date;
  redFrom: Date;
  yellowFrom: Date;
  greenFrom: Date;
}

export interface InstantComparison {
  lt?: Date;
  lte?: Date;
  gt?: Date;
  gte?: Date;
}

/** Comparisons that must ALL hold, per stored field. Plain data: the shape a Prisma `where` takes, without its types. */
export type BandWhere = Partial<Record<keyof BandRow, InstantComparison>>;

/**
 * The rows that are in `band` at `now`, as comparisons over the stored instants. The five answers partition every row
 * whose instants come from `bandInstants` (so redFrom >= yellowFrom >= greenFrom, and all <= dueAt), and agree with
 * `bandOf`.
 */
export function bandWhere(band: Band, now: Date): BandWhere {
  switch (band) {
    case 'OVERDUE':
      return { dueAt: { lt: now } };
    case 'RED':
      return { dueAt: { gte: now }, redFrom: { lte: now } };
    case 'YELLOW':
      return { dueAt: { gte: now }, redFrom: { gt: now }, yellowFrom: { lte: now } };
    case 'GREEN':
      return { dueAt: { gte: now }, yellowFrom: { gt: now }, greenFrom: { lte: now } };
    case 'NONE':
      return { dueAt: { gte: now }, greenFrom: { gt: now } };
  }
}

/**
 * The rows that have a colour at `now` (OVERDUE, RED, YELLOW or GREEN): everything but NONE. One comparison, because the
 * green band starts first and an overdue row started it long ago.
 */
export function colouredWhere(now: Date): BandWhere {
  return { greenFrom: { lte: now } };
}

/** The band of a row at `now`, read off its stored instants. Agrees with `bandOf` and with `bandWhere`. */
export function bandAt(now: Date, row: BandRow): Band {
  const at = now.getTime();
  if (at > row.dueAt.getTime()) return 'OVERDUE';
  if (at >= row.redFrom.getTime()) return 'RED';
  if (at >= row.yellowFrom.getTime()) return 'YELLOW';
  if (at >= row.greenFrom.getTime()) return 'GREEN';
  return 'NONE';
}

/**
 * The earliest of each instant over several deadlines, each on its own (they may come from different rows). Read as
 * ONE row by `bandAt` / `bandWhere`, it gives the WORST band of the rows at any instant: some row is overdue exactly
 * when now is past the earliest deadline, some row is red or worse exactly from the earliest `redFrom`, and so on.
 * `null` when there is no row.
 */
export function earliestInstants(rows: readonly BandRow[]): BandRow | null {
  if (rows.length === 0) return null;
  const earliest = (field: keyof BandRow) => new Date(Math.min(...rows.map((row) => row[field].getTime())));
  return { dueAt: earliest('dueAt'), redFrom: earliest('redFrom'), yellowFrom: earliest('yellowFrom'), greenFrom: earliest('greenFrom') };
}

/**
 * The band of a deadline that is a CALENDAR DAY (the `deadline` column of a record: a day stored at some instant of
 * it): it counts to the end of that civil day in Vietnam.
 */
export function deadlineDayBand(now: Date, deadline: Date, t: Thresholds): Band {
  return bandOf(now, endOfCivilDay(civilDayOf(deadline)), t);
}

/**
 * The calendar-day deadlines that are in `band` at `now`, as ONE comparison over the column itself (no stored
 * instants: the day boundaries are computed from `now`). `null`: no day can be in that band (two thresholds are equal).
 * The five answers partition every deadline and agree with `deadlineDayBand`.
 */
export function deadlineDayWhere(band: Band, now: Date, t: Thresholds): InstantComparison | null {
  validateThresholds(t);
  const today = civilDayOf(now);
  /** The first instant of the day that is more than `days` away. */
  const beyond = (days: number) => startOfCivilDay(today + days + 1);
  const between = (from: Date, to: Date): InstantComparison | null => (from.getTime() < to.getTime() ? { gte: from, lt: to } : null);
  switch (band) {
    case 'OVERDUE':
      return { lt: startOfCivilDay(today) };
    case 'RED':
      return between(startOfCivilDay(today), beyond(t.redDays));
    case 'YELLOW':
      return between(beyond(t.redDays), beyond(t.yellowDays));
    case 'GREEN':
      return between(beyond(t.yellowDays), beyond(t.greenDays));
    case 'NONE':
      return { gte: beyond(t.greenDays) };
  }
}

/**
 * A step against its deadline, by the instant: done at or before the deadline is on time, after it late; not done is
 * in time until the deadline and overdue after it.
 */
export function completionClass(doneAt: Date | null, dueAt: Date, now: Date): CompletionClass {
  if (doneAt !== null) return doneAt.getTime() <= dueAt.getTime() ? 'DONE_ON_TIME' : 'DONE_LATE';
  return now.getTime() > dueAt.getTime() ? 'OPEN_OVERDUE' : 'OPEN_IN_TIME';
}
