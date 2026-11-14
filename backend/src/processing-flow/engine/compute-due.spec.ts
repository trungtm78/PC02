import * as fc from 'fast-check';
import { civilDayFromIso, civilDayOf, civilDayToIso, endOfCivilDay, startOfCivilDay } from './civil-day';
import { computeDue, MAX_DURATION_VALUE } from './compute-due';
import { ProcessingEngineError } from './errors';
import type { DurationUnit } from './types';
import { buildWorkingCalendar, type WorkingCalendar, type WorkingCalendarYearData } from './working-calendar';

/** A date column: the calendar day at 00:00 UTC, no time of day. */
const dayOnly = (iso: string) => ({ at: new Date(`${iso}T00:00:00.000Z`), hasTime: false });
/** An instant given as Vietnam wall-clock time. */
const vn = (isoLocal: string) => new Date(`${isoLocal}+07:00`);
const endOf = (iso: string) => new Date(`${iso}T23:59:59.999+07:00`);

const year = (y: number, status: 'DRAFT' | 'CONFIRMED', days: WorkingCalendarYearData['days'] = []): WorkingCalendarYearData => ({
  year: y,
  weekendDays: [6, 0],
  status,
  days,
});

const PLAIN = buildWorkingCalendar([year(2026, 'CONFIRMED'), year(2027, 'CONFIRMED'), year(2028, 'CONFIRMED'), year(2029, 'CONFIRMED')]);
/** 30 April (Thursday) and 1 May (Friday) 2026 are off: with the weekend, four days in a row. */
const LONG_WEEKEND = buildWorkingCalendar([
  year(2026, 'CONFIRMED', [
    { date: '2026-04-30', kind: 'OFF' },
    { date: '2026-05-01', kind: 'OFF' },
  ]),
]);

const due = (
  anchor: { at: Date; hasTime: boolean },
  value: number,
  unit: DurationUnit,
  options: { roll?: boolean; calendar?: WorkingCalendar } = {},
) => computeDue({ anchor, value, unit, rollToWorkingDay: options.roll ?? false, calendar: options.calendar ?? PLAIN });

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    if (error instanceof ProcessingEngineError) return error.code;
    throw error;
  }
  return undefined;
};

describe('the Vietnam civil day', () => {
  it('23:59:59.999 belongs to the day, 00:00:00.000 to the next one', () => {
    expect(civilDayToIso(civilDayOf(vn('2026-01-05T23:59:59.999')))).toBe('2026-01-05');
    expect(civilDayToIso(civilDayOf(vn('2026-01-06T00:00:00.000')))).toBe('2026-01-06');
  });

  it('a date column stored at 00:00 UTC is that calendar day', () => {
    expect(civilDayToIso(civilDayOf(new Date('2026-01-05T00:00:00.000Z')))).toBe('2026-01-05');
  });

  it('a day starts at 00:00:00.000 +07:00 and ends at 23:59:59.999 +07:00', () => {
    const day = civilDayFromIso('2026-12-31');
    expect(startOfCivilDay(day).toISOString()).toBe('2026-12-30T17:00:00.000Z');
    expect(endOfCivilDay(day).toISOString()).toBe('2026-12-31T16:59:59.999Z');
  });

  it.each(['2026-02-30', '2026-13-01', '26-01-01', '2026-1-1', 'abc', ''])('%p is not a calendar day', (text) => {
    expect(Number.isNaN(civilDayFromIso(text))).toBe(true);
  });

  it('every instant lies inside its own civil day (property)', () => {
    fc.assert(
      fc.property(fc.date({ min: new Date('1990-01-01T00:00:00Z'), max: new Date('2200-01-01T00:00:00Z'), noInvalidDate: true }), (at) => {
        const day = civilDayOf(at);
        expect(startOfCivilDay(day).getTime()).toBeLessThanOrEqual(at.getTime());
        expect(endOfCivilDay(day).getTime()).toBeGreaterThanOrEqual(at.getTime());
        expect(civilDayFromIso(civilDayToIso(day))).toBe(day);
      }),
    );
  });
});

describe('computeDue: calendar days', () => {
  it('the anchor day is not counted; the deadline is the end of day (anchor + value)', () => {
    expect(due(dayOnly('2026-01-05'), 20, 'DAY').dueAt).toEqual(endOf('2026-01-25'));
    expect(due(dayOnly('2026-01-05'), 1, 'DAY').dueAt).toEqual(endOf('2026-01-06'));
  });

  it('the deadline is 23:59:59.999 in Vietnam, which is 16:59:59.999 UTC', () => {
    expect(due(dayOnly('2026-01-05'), 3, 'DAY').dueAt.toISOString()).toBe('2026-01-08T16:59:59.999Z');
  });

  it('value 0 is the end of the anchor day', () => {
    expect(due(dayOnly('2026-01-05'), 0, 'DAY').dueAt).toEqual(endOf('2026-01-05'));
  });

  it('an anchor with a time counts from its Vietnam day: the last millisecond of a day and the first of the next differ by one day', () => {
    expect(due({ at: vn('2026-01-05T23:59:59.999'), hasTime: true }, 2, 'DAY').dueAt).toEqual(endOf('2026-01-07'));
    expect(due({ at: vn('2026-01-06T00:00:00.000'), hasTime: true }, 2, 'DAY').dueAt).toEqual(endOf('2026-01-08'));
  });

  it('crosses a year', () => {
    expect(due(dayOnly('2026-12-20'), 20, 'DAY').dueAt).toEqual(endOf('2027-01-09'));
  });

  it('does not look at the calendar when it does not roll: Saturday stays Saturday, nothing is provisional', () => {
    const result = due(dayOnly('2026-01-05'), 5, 'DAY', { calendar: buildWorkingCalendar([]) });
    expect(result).toEqual({ dueAt: endOf('2026-01-10'), provisional: false, calendarVersion: null });
  });

  it('rolling: a last day on Saturday becomes the end of Monday', () => {
    expect(due(dayOnly('2026-01-05'), 5, 'DAY', { roll: true }).dueAt).toEqual(endOf('2026-01-12'));
  });

  it('rolling: a last day that is a working day stays', () => {
    expect(due(dayOnly('2026-01-05'), 4, 'DAY', { roll: true }).dueAt).toEqual(endOf('2026-01-09'));
  });

  it('rolling over a long weekend: a last day on 30 April lands on Monday 4 May', () => {
    expect(due(dayOnly('2026-04-20'), 10, 'DAY', { roll: true, calendar: LONG_WEEKEND }).dueAt).toEqual(endOf('2026-05-04'));
  });

  it('rolling: a compensatory working Saturday is a working day', () => {
    const calendar = buildWorkingCalendar([year(2026, 'CONFIRMED', [{ date: '2026-01-10', kind: 'WORKING' }])]);
    expect(due(dayOnly('2026-01-05'), 5, 'DAY', { roll: true, calendar }).dueAt).toEqual(endOf('2026-01-10'));
  });
});

describe('computeDue: months', () => {
  it.each([
    ['2026-01-15', 1, '2026-02-15'],
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2028-02-29', 12, '2029-02-28'],
    ['2028-02-29', 48, '2032-02-29'],
    ['2026-03-31', 1, '2026-04-30'],
    ['2026-11-30', 3, '2027-02-28'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-10-31', 4, '2027-02-28'],
    ['2026-01-31', 0, '2026-01-31'],
    ['2026-05-31', 25, '2028-06-30'],
  ])('%s + %i month(s) ends on %s', (from, value, to) => {
    expect(due(dayOnly(from), value, 'MONTH').dueAt).toEqual(endOf(to));
  });

  it('the day of month is taken from the ANCHOR every time, not from a clamped intermediate month', () => {
    // 31 Jan + 2 months is 31 March, not 28 March.
    expect(due(dayOnly('2026-01-31'), 2, 'MONTH').dueAt).toEqual(endOf('2026-03-31'));
  });

  it('rolling: 31 January 2026 + 1 month is Saturday 28 February, so the end of Monday 2 March', () => {
    expect(due(dayOnly('2026-01-31'), 1, 'MONTH', { roll: true }).dueAt).toEqual(endOf('2026-03-02'));
    expect(due(dayOnly('2026-01-31'), 1, 'MONTH').dueAt).toEqual(endOf('2026-02-28'));
  });
});

describe('computeDue: working days', () => {
  it('counts working days after the anchor day', () => {
    // Friday 9 January 2026: the first working day after it is Monday 12.
    expect(due(dayOnly('2026-01-09'), 1, 'WORKING_DAY').dueAt).toEqual(endOf('2026-01-12'));
    expect(due(dayOnly('2026-01-05'), 5, 'WORKING_DAY').dueAt).toEqual(endOf('2026-01-12'));
  });

  it('an anchor on a weekend counts from the next working day on', () => {
    expect(due(dayOnly('2026-01-10'), 1, 'WORKING_DAY').dueAt).toEqual(endOf('2026-01-12'));
  });

  it('skips a long weekend: one working day after Wednesday 29 April is Monday 4 May', () => {
    expect(due(dayOnly('2026-04-29'), 1, 'WORKING_DAY', { calendar: LONG_WEEKEND }).dueAt).toEqual(endOf('2026-05-04'));
    expect(due(dayOnly('2026-04-29'), 1, 'WORKING_DAY').dueAt).toEqual(endOf('2026-04-30'));
  });

  it('a compensatory working Saturday is counted', () => {
    const calendar = buildWorkingCalendar([year(2026, 'CONFIRMED', [{ date: '2026-01-10', kind: 'WORKING' }])]);
    expect(due(dayOnly('2026-01-09'), 1, 'WORKING_DAY', { calendar }).dueAt).toEqual(endOf('2026-01-10'));
  });

  it('value 0 is the anchor day when it is a working day, else the next working day', () => {
    expect(due(dayOnly('2026-01-09'), 0, 'WORKING_DAY').dueAt).toEqual(endOf('2026-01-09'));
    expect(due(dayOnly('2026-01-10'), 0, 'WORKING_DAY').dueAt).toEqual(endOf('2026-01-12'));
  });

  it('400 working days from Monday 5 January 2026, no holidays, is 80 weeks later', () => {
    expect(due(dayOnly('2026-01-05'), 400, 'WORKING_DAY').dueAt).toEqual(endOf('2027-07-19'));
  });

  it('crosses a year over its last weekend', () => {
    // Thursday 31 December 2026 + 2 working days: Friday 1 January is a plain Friday here, then Monday 4.
    expect(due(dayOnly('2026-12-31'), 2, 'WORKING_DAY').dueAt).toEqual(endOf('2027-01-04'));
  });

  it('a calendar in which no day works is refused instead of looping', () => {
    // `buildWorkingCalendar` refuses such a week, so the engine's own guard is shown with a calendar made by hand.
    const every: WorkingCalendar = { isWorkingDay: () => false, isConfirmed: () => true, version: 'none' };
    expect(codeOf(() => due(dayOnly('2026-01-05'), 1, 'WORKING_DAY', { calendar: every }))).toBe('CALENDAR_HAS_NO_WORKING_DAY');
    expect(codeOf(() => due(dayOnly('2026-01-05'), 1, 'DAY', { roll: true, calendar: every }))).toBe('CALENDAR_HAS_NO_WORKING_DAY');
  });
});

describe('computeDue: hours', () => {
  it('is the anchor instant plus the hours, exactly', () => {
    expect(due({ at: vn('2026-01-05T09:30:00.000'), hasTime: true }, 48, 'HOUR').dueAt).toEqual(vn('2026-01-07T09:30:00.000'));
    expect(due({ at: vn('2026-01-05T23:30:00.000'), hasTime: true }, 1, 'HOUR').dueAt).toEqual(vn('2026-01-06T00:30:00.000'));
    expect(due({ at: vn('2026-01-05T09:30:00.000'), hasTime: true }, 0, 'HOUR').dueAt).toEqual(vn('2026-01-05T09:30:00.000'));
  });

  it('needs an anchor with a time of day', () => {
    expect(codeOf(() => due(dayOnly('2026-01-05'), 24, 'HOUR'))).toBe('HOUR_ANCHOR_HAS_NO_TIME');
  });

  it('never rolls and never looks at the calendar, even on a Saturday night', () => {
    const result = due({ at: vn('2026-01-09T20:00:00.000'), hasTime: true }, 24, 'HOUR', { roll: true, calendar: buildWorkingCalendar([]) });
    expect(result).toEqual({ dueAt: vn('2026-01-10T20:00:00.000'), provisional: false, calendarVersion: null });
  });
});

describe('computeDue: what is refused', () => {
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_DURATION_VALUE + 1])('a duration of %p', (value) => {
    for (const unit of ['HOUR', 'DAY', 'WORKING_DAY', 'MONTH'] as const) {
      expect(codeOf(() => due({ at: vn('2026-01-05T09:30:00.000'), hasTime: true }, value, unit))).toBe('DURATION_INVALID');
    }
  });

  it('an anchor that is not a date', () => {
    expect(codeOf(() => due({ at: new Date(Number.NaN), hasTime: false }, 1, 'DAY'))).toBe('ANCHOR_INVALID');
  });

  it('the largest duration is accepted', () => {
    expect(codeOf(() => due(dayOnly('2026-01-05'), MAX_DURATION_VALUE, 'DAY'))).toBeUndefined();
  });
});

describe('computeDue: provisional results and the calendar version', () => {
  const MIXED = buildWorkingCalendar([year(2026, 'CONFIRMED'), year(2027, 'DRAFT')]);

  it('working days inside a confirmed year are final and carry the calendar version', () => {
    expect(due(dayOnly('2026-03-02'), 10, 'WORKING_DAY', { calendar: MIXED })).toEqual({
      dueAt: endOf('2026-03-16'),
      provisional: false,
      calendarVersion: MIXED.version,
    });
  });

  it('working days that reach into a year not confirmed are provisional', () => {
    const result = due(dayOnly('2026-12-28'), 5, 'WORKING_DAY', { calendar: MIXED });
    expect(result).toEqual({ dueAt: endOf('2027-01-04'), provisional: true, calendarVersion: MIXED.version });
  });

  it('a year the calendar holds no row for is not confirmed', () => {
    expect(due(dayOnly('2031-03-03'), 1, 'WORKING_DAY', { calendar: MIXED }).provisional).toBe(true);
  });

  it('rolling that only LOOKED at a day of an unconfirmed year is provisional, even when the day stays', () => {
    // Tuesday 5 January 2027 is a working day as far as the draft calendar knows; a holiday may still be entered.
    const result = due(dayOnly('2026-12-31'), 5, 'DAY', { roll: true, calendar: MIXED });
    expect(result).toEqual({ dueAt: endOf('2027-01-05'), provisional: true, calendarVersion: MIXED.version });
  });

  it('rolling inside a confirmed year is final', () => {
    expect(due(dayOnly('2026-01-05'), 5, 'DAY', { roll: true, calendar: MIXED })).toEqual({
      dueAt: endOf('2026-01-12'),
      provisional: false,
      calendarVersion: MIXED.version,
    });
  });

  it('calendar days and months that do not roll are never provisional', () => {
    const empty = buildWorkingCalendar([]);
    expect(due(dayOnly('2027-01-05'), 30, 'DAY', { calendar: empty })).toMatchObject({ provisional: false, calendarVersion: null });
    expect(due(dayOnly('2027-01-05'), 2, 'MONTH', { calendar: empty })).toMatchObject({ provisional: false, calendarVersion: null });
  });
});

describe('computeDue: properties', () => {
  const anchorDay = fc.integer({ min: civilDayFromIso('2020-01-01'), max: civilDayFromIso('2035-12-31') });
  const holidayCalendar = fc
    .array(fc.tuple(fc.integer({ min: civilDayFromIso('2020-01-01'), max: civilDayFromIso('2040-12-31') }), fc.constantFrom('OFF' as const, 'WORKING' as const)), {
      maxLength: 60,
    })
    .map((entries) => {
      const byYear = new Map<number, Map<string, 'OFF' | 'WORKING'>>();
      for (const [day, kind] of entries) {
        const iso = civilDayToIso(day);
        const y = Number(iso.slice(0, 4));
        if (!byYear.has(y)) byYear.set(y, new Map());
        byYear.get(y)?.set(iso, kind);
      }
      return buildWorkingCalendar(
        [...byYear].map(([y, days]) => ({
          year: y,
          weekendDays: [6, 0],
          status: 'CONFIRMED' as const,
          days: [...days].map(([date, kind]) => ({ date, kind })),
        })),
      );
    });
  const anyAnchor = fc.tuple(anchorDay, fc.integer({ min: 0, max: 86_399_999 })).map(([day, ms]) => new Date(startOfCivilDay(day).getTime() + ms));

  it('DAY: the deadline is the last millisecond of the day `value` days after the anchor day', () => {
    fc.assert(
      fc.property(anyAnchor, fc.integer({ min: 0, max: 800 }), (at, value) => {
        const { dueAt } = due({ at, hasTime: true }, value, 'DAY');
        expect(civilDayOf(dueAt) - civilDayOf(at)).toBe(value);
        expect(dueAt).toEqual(endOfCivilDay(civilDayOf(dueAt)));
      }),
    );
  });

  it('WORKING_DAY: the deadline day is a working day and exactly `value` working days lie after the anchor day up to it', () => {
    fc.assert(
      fc.property(anyAnchor, fc.integer({ min: 1, max: 400 }), holidayCalendar, (at, value, calendar) => {
        const { dueAt } = due({ at, hasTime: true }, value, 'WORKING_DAY', { calendar });
        const last = civilDayOf(dueAt);
        expect(calendar.isWorkingDay(last)).toBe(true);
        let counted = 0;
        for (let day = civilDayOf(at) + 1; day <= last; day++) if (calendar.isWorkingDay(day)) counted++;
        expect(counted).toBe(value);
        expect(dueAt).toEqual(endOfCivilDay(last));
      }),
    );
  });

  it('rolling never moves a deadline earlier, lands on a working day, and skips only non-working days', () => {
    fc.assert(
      fc.property(anyAnchor, fc.integer({ min: 0, max: 400 }), fc.constantFrom('DAY' as const, 'MONTH' as const), holidayCalendar, (at, value, unit, calendar) => {
        const plain = civilDayOf(due({ at, hasTime: true }, value, unit, { calendar }).dueAt);
        const rolled = civilDayOf(due({ at, hasTime: true }, value, unit, { roll: true, calendar }).dueAt);
        expect(rolled).toBeGreaterThanOrEqual(plain);
        expect(calendar.isWorkingDay(rolled)).toBe(true);
        for (let day = plain; day < rolled; day++) expect(calendar.isWorkingDay(day)).toBe(false);
      }),
    );
  });

  it('MONTH: lands in the month `value` months later, on the anchor day of month or on the last day of a shorter month', () => {
    fc.assert(
      fc.property(anyAnchor, fc.integer({ min: 0, max: 240 }), (at, value) => {
        const from = civilDayToIso(civilDayOf(at));
        const to = civilDayToIso(civilDayOf(due({ at, hasTime: true }, value, 'MONTH').dueAt));
        const months = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
        expect(months(to) - months(from)).toBe(value);
        const [fromDay, toDay] = [Number(from.slice(8)), Number(to.slice(8))];
        if (toDay !== fromDay) {
          expect(toDay).toBeLessThan(fromDay);
          // The day after is the first of the next month: `to` is the last day of its month.
          expect(civilDayToIso(civilDayFromIso(to) + 1).slice(8)).toBe('01');
        }
      }),
    );
  });

  it('a longer duration never gives an earlier deadline', () => {
    fc.assert(
      fc.property(
        anyAnchor,
        fc.integer({ min: 0, max: 300 }),
        fc.constantFrom('HOUR' as const, 'DAY' as const, 'WORKING_DAY' as const, 'MONTH' as const),
        fc.boolean(),
        holidayCalendar,
        (at, value, unit, roll, calendar) => {
          const shorter = due({ at, hasTime: true }, value, unit, { roll, calendar }).dueAt.getTime();
          const longer = due({ at, hasTime: true }, value + 1, unit, { roll, calendar }).dueAt.getTime();
          expect(longer).toBeGreaterThanOrEqual(shorter);
        },
      ),
    );
  });
});
