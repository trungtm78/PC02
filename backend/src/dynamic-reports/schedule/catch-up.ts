import { generatePeriods } from '../engine/period';
import type { ScheduleRule, GeneratedPeriod } from '../engine/period';

/**
 * Catch-up generation (spec §6.1 PR5: "Cron + bù kỳ sau downtime"). See
 * catch-up.spec.ts for the full walkthrough of why this walks one period
 * at a time instead of asking the period engine for "everything between
 * two dates" (the engine has no such query — it only answers "N periods
 * starting from the one containing `now`").
 */
export interface CatchUpResult {
  periods: GeneratedPeriod[];
  /** Where the next scheduler tick should resume from. */
  nextCursor: Date;
  /** True if the hard iteration cap was hit before reaching `lookahead` past `now`. */
  truncated: boolean;
}

const DAY_MS = 86_400_000;

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function computePeriodsToEnsure(
  rule: ScheduleRule,
  cursorStart: Date,
  now: Date,
  lookahead: number,
  maxIterations = 1_000,
  nonWorkingDates: ReadonlySet<string> = new Set(),
): CatchUpResult {
  if (rule.periodType === 'ONE_TIME') {
    // D01: "một kỳ một lần, không ngầm lặp" — the engine always returns the
    // same single period regardless of cursor/now, so walking it like the
    // recurring types would loop forever pushing identical periods.
    const [period] = generatePeriods(rule, cursorStart, 1, nonWorkingDates);
    const periodEnd = new Date(`${period.periodEnd}T00:00:00Z`);
    return {
      periods: [period],
      nextCursor: new Date(periodEnd.getTime() + DAY_MS),
      truncated: false,
    };
  }

  // The horizon is measured from `now`: the period containing it plus `lookahead - 1` after it. Measuring from the cursor
  // instead (as this once did) made every tick — the cursor already being past `now` — add `lookahead` MORE periods:
  // 6 an hour, 54 in nine hours, reaching 2031 on production (13/10/2026).
  const [current] = generatePeriods(rule, now, 1, nonWorkingDates);
  let horizonEnd = new Date(`${current.periodEnd}T00:00:00Z`);
  for (let k = 1; k < lookahead; k++) {
    const [next] = generatePeriods(rule, new Date(horizonEnd.getTime() + DAY_MS), 1, nonWorkingDates);
    horizonEnd = new Date(`${next.periodEnd}T00:00:00Z`);
  }

  const periods: GeneratedPeriod[] = [];
  let cursor = cursorStart;
  let truncated = false;

  for (let i = 0; i < maxIterations; i++) {
    // By calendar day: the cursor may carry a time of day (the first run starts at `effectiveFrom`), the horizon is a date.
    if (startOfUtcDay(cursor) > horizonEnd.getTime()) break; // everything up to the horizon already exists
    const [period] = generatePeriods(rule, cursor, 1, nonWorkingDates);
    periods.push(period);

    const periodEnd = new Date(`${period.periodEnd}T00:00:00Z`);
    cursor = new Date(periodEnd.getTime() + DAY_MS);

    if (i === maxIterations - 1 && startOfUtcDay(cursor) <= horizonEnd.getTime()) truncated = true;
  }

  return { periods, nextCursor: cursor, truncated };
}
