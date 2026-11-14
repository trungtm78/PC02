import { civilDayFromIso } from './civil-day';
import { ProcessingEngineError } from './errors';
import { buildWorkingCalendar, checkCalendarYear, DEFAULT_WEEKEND_DAYS, type WorkingCalendarYearData } from './working-calendar';

const on = (iso: string) => civilDayFromIso(iso);
const year = (y: number, over: Partial<WorkingCalendarYearData> = {}): WorkingCalendarYearData => ({
  year: y,
  weekendDays: [6, 0],
  status: 'DRAFT',
  days: [],
  ...over,
});

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    if (error instanceof ProcessingEngineError) return error.code;
    throw error;
  }
  return undefined;
};

describe('buildWorkingCalendar', () => {
  it('the default weekend is Saturday (6) and Sunday (0), in JavaScript weekday numbers', () => {
    expect([...DEFAULT_WEEKEND_DAYS]).toEqual([6, 0]);
  });

  it('a year with no row: weekends off, no holidays, not confirmed', () => {
    const calendar = buildWorkingCalendar([]);
    expect(calendar.isWorkingDay(on('2026-01-09'))).toBe(true); // Friday
    expect(calendar.isWorkingDay(on('2026-01-10'))).toBe(false); // Saturday
    expect(calendar.isWorkingDay(on('2026-01-11'))).toBe(false); // Sunday
    expect(calendar.isWorkingDay(on('2026-01-12'))).toBe(true); // Monday
    expect(calendar.isWorkingDay(on('2026-01-01'))).toBe(true); // a holiday nobody entered
    expect(calendar.isConfirmed(2026)).toBe(false);
  });

  it('a day off on a weekday is not a working day', () => {
    const calendar = buildWorkingCalendar([year(2026, { days: [{ date: '2026-04-30', kind: 'OFF' }] })]);
    expect(calendar.isWorkingDay(on('2026-04-30'))).toBe(false);
    expect(calendar.isWorkingDay(on('2026-04-29'))).toBe(true);
  });

  it('a compensatory working day on a weekend is a working day', () => {
    const calendar = buildWorkingCalendar([year(2026, { days: [{ date: '2026-01-10', kind: 'WORKING' }] })]);
    expect(calendar.isWorkingDay(on('2026-01-10'))).toBe(true);
    expect(calendar.isWorkingDay(on('2026-01-11'))).toBe(false);
  });

  it('the weekend is per year: a year with only Sunday off works on Saturdays', () => {
    const calendar = buildWorkingCalendar([year(2026, { weekendDays: [0] })]);
    expect(calendar.isWorkingDay(on('2026-01-10'))).toBe(true);
    expect(calendar.isWorkingDay(on('2026-01-11'))).toBe(false);
    // 2027 has no row: the default weekend.
    expect(calendar.isWorkingDay(on('2027-01-09'))).toBe(false);
  });

  it('only a year marked CONFIRMED is confirmed', () => {
    const calendar = buildWorkingCalendar([year(2026, { status: 'CONFIRMED' }), year(2027)]);
    expect(calendar.isConfirmed(2026)).toBe(true);
    expect(calendar.isConfirmed(2027)).toBe(false);
    expect(calendar.isConfirmed(2028)).toBe(false);
  });

  it('a day of one year never leaks into another', () => {
    const calendar = buildWorkingCalendar([year(2026, { days: [{ date: '2026-12-31', kind: 'OFF' }] }), year(2027)]);
    expect(calendar.isWorkingDay(on('2026-12-31'))).toBe(false);
    expect(calendar.isWorkingDay(on('2027-12-31'))).toBe(true);
  });

  it.each([
    ['a day outside its year', year(2026, { days: [{ date: '2027-01-01', kind: 'OFF' }] }), 'CALENDAR_DAY_INVALID'],
    ['a day that is not a date', year(2026, { days: [{ date: '2026-02-30', kind: 'OFF' }] }), 'CALENDAR_DAY_INVALID'],
    [
      'the same day twice',
      year(2026, {
        days: [
          { date: '2026-05-01', kind: 'OFF' },
          { date: '2026-05-01', kind: 'WORKING' },
        ],
      }),
      'CALENDAR_DAY_INVALID',
    ],
    ['a kind that does not exist', year(2026, { days: [{ date: '2026-05-01', kind: 'HALF' as never }] }), 'CALENDAR_DAY_INVALID'],
    ['a weekday number that does not exist', year(2026, { weekendDays: [7] }), 'CALENDAR_WEEKEND_INVALID'],
    ['a weekday listed twice', year(2026, { weekendDays: [0, 0] }), 'CALENDAR_WEEKEND_INVALID'],
    ['a week with no working day', year(2026, { weekendDays: [0, 1, 2, 3, 4, 5, 6] }), 'CALENDAR_WEEKEND_INVALID'],
    ['a year that is not a year', year(20.5), 'CALENDAR_YEAR_INVALID'],
    ['a year out of range', year(1899), 'CALENDAR_YEAR_INVALID'],
  ])('%s is refused', (_name, data, code) => {
    expect(codeOf(() => checkCalendarYear(data))).toBe(code);
    expect(codeOf(() => buildWorkingCalendar([data]))).toBe(code);
  });

  it('the same year twice is refused', () => {
    expect(codeOf(() => buildWorkingCalendar([year(2026), year(2026)]))).toBe('CALENDAR_YEAR_INVALID');
  });

  it('a week with no weekend at all is allowed', () => {
    const calendar = buildWorkingCalendar([year(2026, { weekendDays: [] })]);
    expect(calendar.isWorkingDay(on('2026-01-11'))).toBe(true);
  });
});

describe('the version of a working calendar', () => {
  const days = [
    { date: '2026-01-01', kind: 'OFF' as const },
    { date: '2026-04-30', kind: 'OFF' as const },
  ];

  it('is the same for the same data, whatever the order of years, days and weekend numbers', () => {
    const a = buildWorkingCalendar([year(2026, { days }), year(2027, { status: 'CONFIRMED' })]);
    const b = buildWorkingCalendar([year(2027, { status: 'CONFIRMED' }), year(2026, { days: [...days].reverse(), weekendDays: [0, 6] })]);
    expect(a.version).toBe(b.version);
    expect(a.version).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not depend on labels or notes', () => {
    const labelled = days.map((d) => ({ ...d, label: 'Tết Dương lịch' }));
    expect(buildWorkingCalendar([year(2026, { days: labelled })]).version).toBe(buildWorkingCalendar([year(2026, { days })]).version);
  });

  it.each([
    ['a day is added', year(2026, { days: [...days, { date: '2026-05-01', kind: 'OFF' }] })],
    ['a day is removed', year(2026, { days: days.slice(1) })],
    ['a day changes kind', year(2026, { days: [days[0], { date: '2026-04-30', kind: 'WORKING' }] })],
    ['the weekend changes', year(2026, { days, weekendDays: [0] })],
    ['the year is confirmed', year(2026, { days, status: 'CONFIRMED' })],
  ])('changes when %s', (_name, changed) => {
    expect(buildWorkingCalendar([changed]).version).not.toBe(buildWorkingCalendar([year(2026, { days })]).version);
  });

  it('changes when a year is added, even an empty draft one', () => {
    expect(buildWorkingCalendar([year(2026), year(2027)]).version).not.toBe(buildWorkingCalendar([year(2026)]).version);
  });
});
