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

  const periods: GeneratedPeriod[] = [];
  let cursor = cursorStart;
  let lookaheadRemaining = -1; // -1 = haven't reached the period containing `now` yet
  let truncated = false;

  for (let i = 0; i < maxIterations; i++) {
    const [period] = generatePeriods(rule, cursor, 1, nonWorkingDates);
    periods.push(period);

    const periodEnd = new Date(`${period.periodEnd}T00:00:00Z`);
    cursor = new Date(periodEnd.getTime() + DAY_MS);

    if (lookaheadRemaining === -1 && periodEnd >= now) {
      lookaheadRemaining = lookahead - 1;
    } else if (lookaheadRemaining >= 0) {
      lookaheadRemaining--;
    }

    if (lookaheadRemaining === 0) break;
    if (i === maxIterations - 1) truncated = true;
  }

  return { periods, nextCursor: cursor, truncated };
}
