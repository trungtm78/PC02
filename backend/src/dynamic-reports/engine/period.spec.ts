import { generatePeriods } from './period';
import type { ScheduleRule } from './period';

/**
 * Period engine — ScheduleRule + now -> a list of periods (spec §4.1).
 * Pure, no I/O. All wall-clock math is Vietnam business time, UTC+7, no
 * DST (same fixed-offset convention as notifications/work-hours.util.ts
 * and document-numbers/period-key.util.ts). `now` is always passed in so
 * every test can pin the clock (spec §8 "đồng hồ điều khiển được").
 *
 * periodKey convention matches the existing document-numbers/period-key.util.ts:
 * YEARLY="2026", MONTHLY="2026-10", WEEKLY="2026-W41"; this engine adds
 * QUARTERLY="2026-Q4", SEMI_ANNUAL="2026-H1", DAILY="2026-10-09".
 */

const vnNow = (y: number, m: number, d: number, hh: number, mm: number): Date =>
  new Date(Date.UTC(y, m - 1, d, hh - 7, mm)); // VN wall clock -> UTC instant

describe('WEEKLY — FRD §5 "tuần 41/2026 là 05-11/10/2026, khoá thứ Sáu 09/10 lúc 17:00"', () => {
  const rule: ScheduleRule = {
    periodType: 'WEEKLY',
    due: {
      kind: 'FIXED_IN_PERIOD',
      periodOffset: 0,
      anchorWeekday: 5,
      time: '17:00',
    },
    open: { kind: 'AT_PERIOD_START' },
  };

  it('generates week 41/2026 as 2026-10-05..2026-10-11 with periodKey 2026-W41', () => {
    const [period] = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 1);
    expect(period.periodKey).toBe('2026-W41');
    expect(period.periodStart).toBe('2026-10-05');
    expect(period.periodEnd).toBe('2026-10-11');
  });

  it('due is Friday 2026-10-09 17:00 VN = 2026-10-09T10:00:00.000Z', () => {
    const [period] = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 1);
    expect(period.dueAt).toBe('2026-10-09T10:00:00.000Z');
  });

  it('opens at the period start (2026-10-05 00:00 VN = 2026-10-04T17:00:00.000Z)', () => {
    const [period] = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 1);
    expect(period.opensAt).toBe('2026-10-04T17:00:00.000Z');
  });

  it('warns when the due date falls before the period actually ends (locked while still open per calendar)', () => {
    const [period] = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 1);
    expect(
      period.warnings.some((w) => w.code === 'LOCKED_BEFORE_PERIOD_END'),
    ).toBe(true);
  });

  it('previews at least 6 upcoming periods', () => {
    const periods = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 6);
    expect(periods).toHaveLength(6);
    expect(periods.map((p) => p.periodKey)).toEqual([
      '2026-W41',
      '2026-W42',
      '2026-W43',
      '2026-W44',
      '2026-W45',
      '2026-W46',
    ]);
  });

  it('handles the ISO week year-crossing boundary correctly in periodKey', () => {
    // 2026-12-31 is in ISO week 53 of 2026; the next week is W01 of 2027.
    const periods = generatePeriods(rule, vnNow(2026, 12, 28, 10, 0), 3);
    expect(periods.map((p) => p.periodKey)).toEqual([
      '2026-W53',
      '2027-W01',
      '2027-W02',
    ]);
  });
});

describe('MONTHLY — FRD §5 "tháng 10 khóa 31/10 lúc 17:00"', () => {
  const rule: ScheduleRule = {
    periodType: 'MONTHLY',
    due: {
      kind: 'FIXED_IN_PERIOD',
      periodOffset: 0,
      anchorDay: 31,
      time: '17:00',
    },
    open: { kind: 'AT_PERIOD_START' },
  };

  it('generates October 2026 with due 2026-10-31 17:00 VN', () => {
    const [period] = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 1);
    expect(period.periodKey).toBe('2026-10');
    expect(period.periodStart).toBe('2026-10-01');
    expect(period.periodEnd).toBe('2026-10-31');
    expect(period.dueAt).toBe('2026-10-31T10:00:00.000Z');
  });

  it('D08: clamps day 31 to 28 in Feb 2027 (non-leap) with a warning', () => {
    const periods = generatePeriods(rule, vnNow(2027, 2, 1, 10, 0), 1);
    const [period] = periods;
    expect(period.periodKey).toBe('2027-02');
    expect(period.periodEnd).toBe('2027-02-28');
    expect(period.dueAt).toBe('2027-02-28T10:00:00.000Z');
    expect(
      period.warnings.some((w) => w.code === 'DAY_CLAMPED_TO_MONTH_END'),
    ).toBe(true);
  });

  it('clamps day 31 to 29 in Feb 2028 (leap year)', () => {
    const [period] = generatePeriods(rule, vnNow(2028, 2, 1, 10, 0), 1);
    expect(period.dueAt).toBe('2028-02-29T10:00:00.000Z');
  });

  it('D02: custom period-start-day 21 gives a period from the 21st to the 20th of next month', () => {
    const customRule: ScheduleRule = {
      periodType: 'MONTHLY',
      periodStartDay: 21,
      due: {
        kind: 'FIXED_IN_PERIOD',
        periodOffset: 0,
        anchorDay: 20,
        time: '17:00',
      },
      open: { kind: 'AT_PERIOD_START' },
    };
    const [period] = generatePeriods(customRule, vnNow(2026, 10, 25, 10, 0), 1);
    expect(period.periodStart).toBe('2026-10-21');
    expect(period.periodEnd).toBe('2026-11-20');
  });

  it('DAYS_AFTER_END: due N days after period end', () => {
    const daysAfterRule: ScheduleRule = {
      periodType: 'MONTHLY',
      due: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
      open: { kind: 'AT_PERIOD_START' },
    };
    const [period] = generatePeriods(
      daysAfterRule,
      vnNow(2026, 10, 9, 10, 0),
      1,
    );
    expect(period.periodEnd).toBe('2026-10-31');
    expect(period.dueAt).toBe('2026-11-05T10:00:00.000Z'); // Oct 31 + 5 days = Nov 5, 17:00 VN
  });
});

describe('QUARTERLY — FRD §5 "quý IV chọn tháng thứ 3/ngày 25 thì hạn 25/12 lúc 17:00"', () => {
  const rule: ScheduleRule = {
    periodType: 'QUARTERLY',
    due: {
      kind: 'FIXED_IN_PERIOD',
      periodOffset: 0,
      anchorMonth: 3,
      anchorDay: 25,
      time: '17:00',
    },
    open: { kind: 'AT_PERIOD_START' },
  };

  it('generates Q4 2026 (Oct-Dec) with due 2026-12-25 17:00 VN', () => {
    const [period] = generatePeriods(rule, vnNow(2026, 11, 1, 10, 0), 1);
    expect(period.periodKey).toBe('2026-Q4');
    expect(period.periodStart).toBe('2026-10-01');
    expect(period.periodEnd).toBe('2026-12-31');
    expect(period.dueAt).toBe('2026-12-25T10:00:00.000Z');
  });

  it('rolls QIV 2026 -> QI 2027 across the year boundary', () => {
    const periods = generatePeriods(rule, vnNow(2026, 11, 1, 10, 0), 2);
    expect(periods.map((p) => p.periodKey)).toEqual(['2026-Q4', '2027-Q1']);
    expect(periods[1].periodStart).toBe('2027-01-01');
    expect(periods[1].periodEnd).toBe('2027-03-31');
  });
});

describe('SEMI_ANNUAL', () => {
  const rule: ScheduleRule = {
    periodType: 'SEMI_ANNUAL',
    due: { kind: 'FIXED_IN_PERIOD', periodOffset: 0, anchorMonth: 2, anchorDay: 15, time: '17:00' },
    open: { kind: 'AT_PERIOD_START' },
  };

  it('generates H2 2026 (Jul-Dec) with due on the 2nd month (Aug) day 15', () => {
    const [period] = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 1);
    expect(period.periodKey).toBe('2026-H2');
    expect(period.periodStart).toBe('2026-07-01');
    expect(period.periodEnd).toBe('2026-12-31');
    expect(period.dueAt).toBe('2026-08-15T10:00:00.000Z');
  });

  it('rolls H2 2026 -> H1 2027 across the year boundary', () => {
    const periods = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 2);
    expect(periods.map((p) => p.periodKey)).toEqual(['2026-H2', '2027-H1']);
    expect(periods[1].periodStart).toBe('2027-01-01');
    expect(periods[1].periodEnd).toBe('2027-06-30');
  });
});

describe('YEARLY', () => {
  const rule: ScheduleRule = {
    periodType: 'YEARLY',
    due: { kind: 'FIXED_IN_PERIOD', periodOffset: 0, anchorMonth: 1, anchorDay: 31, time: '17:00' },
    open: { kind: 'AT_PERIOD_START' },
  };

  it('generates calendar year 2026 with due Jan 31 2026', () => {
    const [period] = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 1);
    expect(period.periodKey).toBe('2026');
    expect(period.periodStart).toBe('2026-01-01');
    expect(period.periodEnd).toBe('2026-12-31');
    expect(period.dueAt).toBe('2026-01-31T10:00:00.000Z');
  });

  it('rolls 2026 -> 2027', () => {
    const periods = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 2);
    expect(periods.map((p) => p.periodKey)).toEqual(['2026', '2027']);
  });

  it('D08: clamps an impossible day-of-month (Feb 30) to the real month end, with a warning', () => {
    const clampRule: ScheduleRule = {
      periodType: 'YEARLY',
      due: { kind: 'FIXED_IN_PERIOD', periodOffset: 0, anchorMonth: 2, anchorDay: 30, time: '17:00' },
      open: { kind: 'AT_PERIOD_START' },
    };
    const [period] = generatePeriods(clampRule, vnNow(2026, 1, 1, 10, 0), 1);
    expect(period.dueAt).toBe('2026-02-28T10:00:00.000Z');
    expect(period.warnings.some((w) => w.code === 'DAY_CLAMPED_TO_MONTH_END')).toBe(true);
  });
});

describe('DAILY', () => {
  const rule: ScheduleRule = {
    periodType: 'DAILY',
    due: { kind: 'FIXED_IN_PERIOD', periodOffset: 0, time: '17:00' },
    open: { kind: 'AT_PERIOD_START' },
  };

  it('generates a single calendar day with periodKey = ISO date', () => {
    const [period] = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 1);
    expect(period.periodKey).toBe('2026-10-09');
    expect(period.periodStart).toBe('2026-10-09');
    expect(period.periodEnd).toBe('2026-10-09');
    expect(period.dueAt).toBe('2026-10-09T10:00:00.000Z');
  });
});

describe('ONE_TIME — D01: "Một kỳ một lần, không ngầm lặp hằng ngày"', () => {
  const rule: ScheduleRule = {
    periodType: 'ONE_TIME',
    oneTimeDate: '2026-10-09',
    due: { kind: 'FIXED_IN_PERIOD', periodOffset: 0, time: '17:00' },
    open: { kind: 'AT_PERIOD_START' },
  };

  it('generates exactly one period regardless of the requested count', () => {
    const periods = generatePeriods(rule, vnNow(2026, 10, 1, 10, 0), 6);
    expect(periods).toHaveLength(1);
    expect(periods[0].periodKey).toBe('2026-10-09');
    expect(periods[0].dueAt).toBe('2026-10-09T10:00:00.000Z');
  });

  it('throws a configuration error when oneTimeDate is missing (programmer error, not a user-facing validation path)', () => {
    const brokenRule = { ...rule, oneTimeDate: undefined };
    expect(() => generatePeriods(brokenRule, vnNow(2026, 10, 1, 10, 0), 1)).toThrow(
      'ONE_TIME schedule requires oneTimeDate.',
    );
  });
});

describe('Non-working-day shift (D02 extension)', () => {
  it('shifts a DAYS_AFTER_END due date landing on a configured non-working day to the next working day', () => {
    const rule: ScheduleRule = {
      periodType: 'MONTHLY',
      due: { kind: 'DAYS_AFTER_END', days: 1, time: '17:00' },
      open: { kind: 'AT_PERIOD_START' },
      shiftNonWorking: true,
    };
    // Sept 2026 ends 2026-09-30; +1 day = 2026-10-01. Mark 2026-10-01 as a
    // non-working day (e.g. a holiday) -> due shifts to 2026-10-02.
    const nonWorkingDates = new Set(['2026-10-01']);
    const [period] = generatePeriods(
      rule,
      vnNow(2026, 9, 15, 10, 0),
      1,
      nonWorkingDates,
    );
    expect(period.dueAt).toBe('2026-10-02T10:00:00.000Z');
    expect(period.originalDueAt).toBe('2026-10-01T10:00:00.000Z');
    expect(
      period.warnings.some((w) => w.code === 'DUE_SHIFTED_NON_WORKING_DAY'),
    ).toBe(true);
  });

  it('does not shift when shiftNonWorking is false/omitted, even if the date is marked non-working', () => {
    const rule: ScheduleRule = {
      periodType: 'MONTHLY',
      due: { kind: 'DAYS_AFTER_END', days: 1, time: '17:00' },
      open: { kind: 'AT_PERIOD_START' },
    };
    const nonWorkingDates = new Set(['2026-10-01']);
    const [period] = generatePeriods(
      rule,
      vnNow(2026, 9, 15, 10, 0),
      1,
      nonWorkingDates,
    );
    expect(period.dueAt).toBe('2026-10-01T10:00:00.000Z');
    expect(period.originalDueAt).toBe(period.dueAt);
  });
});

describe('Open rule — DAYS_BEFORE_DUE', () => {
  it('opens N days before the due date instead of at period start', () => {
    const rule: ScheduleRule = {
      periodType: 'MONTHLY',
      due: {
        kind: 'FIXED_IN_PERIOD',
        periodOffset: 0,
        anchorDay: 31,
        time: '17:00',
      },
      open: { kind: 'DAYS_BEFORE_DUE', days: 3 },
    };
    const [period] = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 1);
    // due = 2026-10-31 17:00 VN; opens 3 days before at the same time of day.
    expect(period.opensAt).toBe('2026-10-28T10:00:00.000Z');
  });
});

describe('Vietnamese natural-language description (for S05-S08 preview)', () => {
  it('produces a human-readable description for a weekly rule', () => {
    const rule: ScheduleRule = {
      periodType: 'WEEKLY',
      due: {
        kind: 'FIXED_IN_PERIOD',
        periodOffset: 0,
        anchorWeekday: 5,
        time: '17:00',
      },
      open: { kind: 'AT_PERIOD_START' },
    };
    const [period] = generatePeriods(rule, vnNow(2026, 10, 9, 10, 0), 1);
    expect(period.description.length).toBeGreaterThan(0);
    expect(period.description).toContain('17:00');
  });
});
