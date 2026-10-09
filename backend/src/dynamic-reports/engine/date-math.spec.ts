import {
  daysInMonth,
  isValidCalendarDate,
  isLeapYear,
  clampDayToMonthEnd,
  addDays,
  isoWeekday,
  isoWeekInfo,
  isoWeekMonday,
  quarterOfMonth,
  isoDateOnly,
} from './date-math';

/**
 * Shared calendar arithmetic for values.ts and period.ts. Pure, no I/O.
 * Every function takes plain (year, month, day) integers and never reads
 * a `Date` back in the runtime's local timezone — the bug class FRD §4.4
 * explicitly warns against.
 */
describe('daysInMonth / isValidCalendarDate', () => {
  it('April has 30 days', () => expect(daysInMonth(2026, 4)).toBe(30));
  it('February 2026 (non-leap) has 28 days', () =>
    expect(daysInMonth(2026, 2)).toBe(28));
  it('February 2028 (leap) has 29 days', () =>
    expect(daysInMonth(2028, 2)).toBe(29));
  it('February 2000 (divisible by 400) has 29 days', () =>
    expect(daysInMonth(2000, 2)).toBe(29));
  it('February 1900 (divisible by 100, not 400) has 28 days', () =>
    expect(daysInMonth(1900, 2)).toBe(28));
  it('December has 31 days', () => expect(daysInMonth(2026, 12)).toBe(31));

  it('rejects Feb 31', () =>
    expect(isValidCalendarDate(2026, 2, 31)).toBe(false));
  it('rejects Feb 29 on a non-leap year', () =>
    expect(isValidCalendarDate(2026, 2, 29)).toBe(false));
  it('accepts Feb 29 on a leap year', () =>
    expect(isValidCalendarDate(2028, 2, 29)).toBe(true));
  it('rejects month 0 and month 13', () => {
    expect(isValidCalendarDate(2026, 0, 1)).toBe(false);
    expect(isValidCalendarDate(2026, 13, 1)).toBe(false);
  });
  it('rejects day 0', () =>
    expect(isValidCalendarDate(2026, 1, 0)).toBe(false));
});

describe('isLeapYear', () => {
  it('2028 is leap, 2026/2027 are not', () => {
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2027)).toBe(false);
  });
  it('2000 is leap (div by 400), 1900 is not (div by 100 not 400)', () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });
});

describe('clampDayToMonthEnd (D08: "ngày 29-31 không tồn tại thì lấy ngày cuối tháng")', () => {
  it('clamps day 31 to 28 in Feb 2027 (non-leap)', () => {
    const result = clampDayToMonthEnd(2027, 2, 31);
    expect(result).toEqual({ day: 28, clamped: true });
  });
  it('clamps day 31 to 29 in Feb 2028 (leap)', () => {
    expect(clampDayToMonthEnd(2028, 2, 31)).toEqual({ day: 29, clamped: true });
  });
  it('does not clamp day 31 in a 31-day month', () => {
    expect(clampDayToMonthEnd(2026, 10, 31)).toEqual({
      day: 31,
      clamped: false,
    });
  });
  it('clamps day 31 to 30 in a 30-day month', () => {
    expect(clampDayToMonthEnd(2026, 4, 31)).toEqual({ day: 30, clamped: true });
  });
});

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays(2026, 10, 9, 2)).toEqual({ year: 2026, month: 10, day: 11 });
  });
  it('rolls over a month boundary', () => {
    expect(addDays(2026, 10, 31, 1)).toEqual({ year: 2026, month: 11, day: 1 });
  });
  it('rolls over a year boundary', () => {
    expect(addDays(2026, 12, 31, 1)).toEqual({ year: 2027, month: 1, day: 1 });
  });
  it('subtracts days (negative input)', () => {
    expect(addDays(2026, 1, 1, -1)).toEqual({ year: 2025, month: 12, day: 31 });
  });
  it('crosses the Feb 29 leap day correctly', () => {
    expect(addDays(2028, 2, 28, 1)).toEqual({ year: 2028, month: 2, day: 29 });
    expect(addDays(2028, 2, 29, 1)).toEqual({ year: 2028, month: 3, day: 1 });
  });
});

describe('isoWeekday', () => {
  it('2026-10-09 (a Friday) is ISO weekday 5', () => {
    expect(isoWeekday(2026, 10, 9)).toBe(5);
  });
  it('a Sunday is ISO weekday 7, not 0', () => {
    expect(isoWeekday(2026, 10, 11)).toBe(7);
  });
  it('a Monday is ISO weekday 1', () => {
    expect(isoWeekday(2026, 10, 5)).toBe(1);
  });
});

describe('isoWeekInfo / isoWeekMonday — FRD §5 "tuần 41/2026 là 05-11/10/2026"', () => {
  it('2026-10-09 falls in ISO week 41 of 2026', () => {
    expect(isoWeekInfo(2026, 10, 9)).toEqual({ isoYear: 2026, isoWeek: 41 });
  });

  it('ISO week 41 of 2026 starts on Monday 2026-10-05', () => {
    expect(isoWeekMonday(2026, 41)).toEqual({ year: 2026, month: 10, day: 5 });
  });

  it('handles the year-crossing week: Dec 31 2029 belongs to ISO week 1 of 2030', () => {
    // 2029-12-31 is a Monday; ISO week-year assigns it to the week
    // containing the following Thursday (2030-01-03), which is week 1 of 2030.
    expect(isoWeekday(2029, 12, 31)).toBe(1);
    expect(isoWeekInfo(2029, 12, 31)).toEqual({ isoYear: 2030, isoWeek: 1 });
  });

  it('handles the year-crossing week: Jan 1 2027 still belongs to ISO week 53 of 2026', () => {
    // 2027-01-01 is a Friday; its Thursday is 2026-12-31, so it's in 2026's
    // last ISO week. 2026 has 53 ISO weeks (2026-01-01 is a Thursday).
    expect(isoWeekInfo(2027, 1, 1)).toEqual({ isoYear: 2026, isoWeek: 53 });
  });

  it('round-trips isoWeekInfo -> isoWeekMonday for a year-crossing week', () => {
    const info = isoWeekInfo(2027, 1, 1);
    const monday = isoWeekMonday(info.isoYear, info.isoWeek);
    // That week's Monday must be on or before 2027-01-01 and the date must
    // fall within [Monday, Monday+6].
    const mondayEpochIsoDate = isoDateOnly(
      monday.year,
      monday.month,
      monday.day,
    );
    expect(mondayEpochIsoDate <= '2027-01-01').toBe(true);
  });
});

describe('quarterOfMonth', () => {
  it('maps months to calendar quarters', () => {
    expect(quarterOfMonth(1)).toBe(1);
    expect(quarterOfMonth(3)).toBe(1);
    expect(quarterOfMonth(4)).toBe(2);
    expect(quarterOfMonth(6)).toBe(2);
    expect(quarterOfMonth(7)).toBe(3);
    expect(quarterOfMonth(9)).toBe(3);
    expect(quarterOfMonth(10)).toBe(4);
    expect(quarterOfMonth(12)).toBe(4);
  });
});

describe('isoDateOnly', () => {
  it('pads single-digit month/day with zero', () => {
    expect(isoDateOnly(2026, 1, 5)).toBe('2026-01-05');
  });
});
