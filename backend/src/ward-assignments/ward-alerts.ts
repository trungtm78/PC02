import type { Prisma } from '@prisma/client';

/**
 * The deadline alert of a ward assignment request ("Hạn báo kết quả" coloured), as pure functions of the request and
 * "today" (the calendar day in Viet Nam, `vnDay(now)`; days are dates at 00:00 UTC, never instants). The list field,
 * the list filter, the cards and the statistics all take the level from here, with the same "today", so that a number
 * on a card is the number of rows its filter shows.
 *
 *   DONE     the request is completed ("Ngày hoàn thành" written), whatever its deadline;
 *   OVERDUE  the deadline is before today;
 *   RED      0 to 3 days left (the deadline is today, or within 3 days);
 *   YELLOW   4 to 7 days left;
 *   NONE     anything else: not approved, no deadline yet, or more than 7 days left.
 *
 * The thresholds are constants: the system settings have no typed place for them yet (see the report of lane D).
 */
export const ALERT_YELLOW_DAYS = 7;
export const ALERT_RED_DAYS = 3;

export const ALERT_LEVELS = ['NONE', 'YELLOW', 'RED', 'OVERDUE', 'DONE'] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export interface WardAlert {
  level: AlertLevel;
  /** The deadline, `YYYY-MM-DD`, or null when there is none. */
  dueOn: string | null;
  /** Whole days from today to the deadline (negative once overdue); null when done or without a deadline. */
  daysLeft: number | null;
}

const DAY_MS = 86_400_000;

export interface AlertInput {
  status: string;
  resultDueOn: Date | null;
  completedOn: Date | null;
}

const isoDay = (day: Date | null): string | null => (day ? day.toISOString().slice(0, 10) : null);
const plusDays = (day: Date, days: number): Date => new Date(day.getTime() + days * DAY_MS);

export function alertOf(row: AlertInput, today: Date): WardAlert {
  const dueOn = isoDay(row.resultDueOn);
  if (row.status !== 'APPROVED') return { level: 'NONE', dueOn, daysLeft: null };
  if (row.completedOn) return { level: 'DONE', dueOn, daysLeft: null };
  if (!row.resultDueOn) return { level: 'NONE', dueOn: null, daysLeft: null };
  const daysLeft = Math.round((row.resultDueOn.getTime() - today.getTime()) / DAY_MS);
  const level: AlertLevel = daysLeft < 0 ? 'OVERDUE' : daysLeft <= ALERT_RED_DAYS ? 'RED' : daysLeft <= ALERT_YELLOW_DAYS ? 'YELLOW' : 'NONE';
  return { level, dueOn, daysLeft };
}

/** Rounds that count as a submission: all but those taken back before PC02 decided. */
const COUNTED_ROUND = { status: { not: 'WITHDRAWN' as const } };
const VN_OFFSET_MS = 7 * 3_600_000;

/**
 * The requests first submitted within [from, to], calendar days in Viet Nam (either bound may be left open): a counted
 * round submitted within the period, and none before it. The statistics and the list filter use this one condition,
 * so a number of the statistics opens exactly its rows.
 */
export function firstSubmittedWhere(from: Date | null, to: Date | null): Prisma.WardAssignmentWhereInput {
  const start = from ? new Date(from.getTime() - VN_OFFSET_MS) : null;
  const end = to ? new Date(to.getTime() + DAY_MS - VN_OFFSET_MS) : null;
  if (!start && !end) return {};
  return {
    rounds: {
      some: { ...COUNTED_ROUND, submittedAt: { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) } },
      ...(start ? { none: { ...COUNTED_ROUND, submittedAt: { lt: start } } } : {}),
    },
  };
}

/**
 * The condition of the rows of one level, for `WardAssignment` queries: the same rule as `alertOf`, written so that
 * every row satisfies exactly one level (the levels partition the table).
 */
export function alertWhere(level: AlertLevel, today: Date): Prisma.WardAssignmentWhereInput {
  const open = { status: 'APPROVED' as const, completedOn: null };
  switch (level) {
    case 'DONE':
      return { status: 'APPROVED', completedOn: { not: null } };
    case 'OVERDUE':
      return { ...open, resultDueOn: { lt: today } };
    case 'RED':
      return { ...open, resultDueOn: { gte: today, lte: plusDays(today, ALERT_RED_DAYS) } };
    case 'YELLOW':
      return { ...open, resultDueOn: { gt: plusDays(today, ALERT_RED_DAYS), lte: plusDays(today, ALERT_YELLOW_DAYS) } };
    case 'NONE':
      return {
        OR: [
          { status: { not: 'APPROVED' } },
          { ...open, resultDueOn: null },
          { ...open, resultDueOn: { gt: plusDays(today, ALERT_YELLOW_DAYS) } },
        ],
      };
  }
}
