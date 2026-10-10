import { computePeriodsToEnsure } from './catch-up';
import type { ScheduleRule } from '../engine/period';

/**
 * Catch-up generation (spec §6.1 PR5: "Cron + bù kỳ sau downtime"). The
 * period engine only answers "give me N periods starting from the one
 * containing `now`" — it has no notion of "between two dates". This
 * walks forward one period at a time from a cursor (the schedule's
 * `lastGeneratedThrough`, or `effectiveFrom` on the very first run),
 * which is what actually fills a gap left by scheduler downtime: the
 * cursor doesn't move until a period is confirmed generated, so a run
 * that crashes halfway through just re-walks the same ground next tick.
 */
describe('computePeriodsToEnsure', () => {
  const monthlyRule: ScheduleRule = {
    periodType: 'MONTHLY',
    due: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
    open: { kind: 'AT_PERIOD_START' },
  };

  it('generates exactly `lookahead` periods when the cursor already equals now (steady state, no catch-up needed)', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    const result = computePeriodsToEnsure(monthlyRule, now, now, 3);
    expect(result.periods).toHaveLength(3);
    expect(result.periods[0].periodKey).toBe('2026-06');
  });

  it('walks forward from an old cursor through several missed periods, up to the lookahead window past now', () => {
    const cursor = new Date('2026-01-01T00:00:00Z'); // scheduler "died" in January
    const now = new Date('2026-06-15T10:00:00Z'); // and was only restarted in June
    const result = computePeriodsToEnsure(monthlyRule, cursor, now, 2);

    const keys = result.periods.map((p) => p.periodKey);
    // Every missed month from January through June, plus 1 lookahead period.
    expect(keys).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ]);
  });

  it('advances the returned cursor to one day past the last generated period, so the next run starts at the following period rather than regenerating the same one', () => {
    const cursor = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-06-15T10:00:00Z');
    const result = computePeriodsToEnsure(monthlyRule, cursor, now, 1);
    const lastPeriod = result.periods[result.periods.length - 1];
    expect(lastPeriod.periodKey).toBe('2026-06');
    expect(result.nextCursor.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('never loops forever on a pathological schedule — stops at the hard iteration cap', () => {
    const dailyRule: ScheduleRule = {
      periodType: 'DAILY',
      due: { kind: 'DAYS_AFTER_END', days: 1, time: '17:00' },
      open: { kind: 'AT_PERIOD_START' },
    };
    const cursor = new Date('2000-01-01T00:00:00Z');
    const now = new Date('2026-06-15T10:00:00Z');
    const result = computePeriodsToEnsure(dailyRule, cursor, now, 1, 50);
    expect(result.periods.length).toBeLessThanOrEqual(50);
    expect(result.truncated).toBe(true);
  });

  it('forwards nonWorkingDates through to the period engine so shiftNonWorking due dates land correctly', () => {
    const shiftingRule: ScheduleRule = {
      periodType: 'MONTHLY',
      due: { kind: 'DAYS_AFTER_END', days: 0, time: '17:00' },
      open: { kind: 'AT_PERIOD_START' },
      shiftNonWorking: true,
    };
    const now = new Date('2026-01-15T10:00:00Z');
    // January ends on the 31st (a Saturday in 2026) — shiftNonWorking should
    // push the due date forward if that date is marked non-working.
    const nonWorkingDates = new Set(['2026-01-31']);
    const result = computePeriodsToEnsure(
      shiftingRule,
      now,
      now,
      1,
      1_000,
      nonWorkingDates,
    );
    const warningCodes = result.periods[0].warnings.map((w) => w.code);
    expect(warningCodes).toContain('DUE_SHIFTED_NON_WORKING_DAY');
  });

  it('returns exactly one period for a ONE_TIME schedule, never looping (the engine returns the same period regardless of cursor)', () => {
    const oneTimeRule: ScheduleRule = {
      periodType: 'ONE_TIME',
      oneTimeDate: '2026-03-15',
      due: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
      open: { kind: 'AT_PERIOD_START' },
    };
    const cursor = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-06-15T10:00:00Z');
    const result = computePeriodsToEnsure(oneTimeRule, cursor, now, 3);
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].periodKey).toBe('2026-03-15');
    expect(result.truncated).toBe(false);
  });

  it('is not truncated when every missed period fits under the iteration cap', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    const result = computePeriodsToEnsure(monthlyRule, now, now, 3, 50);
    expect(result.truncated).toBe(false);
  });
});
