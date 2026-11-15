import { describe, it, expect } from 'vitest';
import {
  addDaysInYear,
  expandRange,
  removeDay,
  toggleWeekendDay,
  toSaveBody,
  DEFAULT_WEEKEND_DAYS,
  type CalendarEditState,
} from '../calendar';

describe('expanding a range of days', () => {
  it('lists every day from the first to the last, both included', () => {
    expect(expandRange('2026-02-16', '2026-02-20')).toEqual(['2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20']);
  });

  it('crosses a month end and a leap day without skipping', () => {
    expect(expandRange('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  });

  it('one day is a range of one', () => {
    expect(expandRange('2026-09-02', '2026-09-02')).toEqual(['2026-09-02']);
  });

  it('a last day before the first, or a date that is not a date, is empty', () => {
    expect(expandRange('2026-02-20', '2026-02-16')).toEqual([]);
    expect(expandRange('', '2026-02-16')).toEqual([]);
    expect(expandRange('2026-02-30', '2026-03-02')).toEqual([]);
  });
});

describe('adding days to a year', () => {
  const none: CalendarEditState['days'] = [];

  it('adds the days in date order, with their kind and label', () => {
    const { days, skipped } = addDaysInYear(none, 2026, ['2026-09-03', '2026-09-02'], 'OFF', 'Quốc khánh');
    expect(days).toEqual([
      { date: '2026-09-02', kind: 'OFF', label: 'Quốc khánh' },
      { date: '2026-09-03', kind: 'OFF', label: 'Quốc khánh' },
    ]);
    expect(skipped).toBe(0);
  });

  it('a day already listed is replaced, not doubled', () => {
    const first = addDaysInYear(none, 2026, ['2026-09-02'], 'OFF', 'a').days;
    const { days } = addDaysInYear(first, 2026, ['2026-09-02'], 'WORKING', 'làm bù');
    expect(days).toEqual([{ date: '2026-09-02', kind: 'WORKING', label: 'làm bù' }]);
  });

  it('a day outside the year is left out and counted', () => {
    const { days, skipped } = addDaysInYear(none, 2026, ['2025-12-31', '2026-01-01', '2027-01-01'], 'OFF', '');
    expect(days.map((d) => d.date)).toEqual(['2026-01-01']);
    expect(skipped).toBe(2);
  });

  it('an empty label is stored as null', () => {
    expect(addDaysInYear(none, 2026, ['2026-01-01'], 'OFF', '  ').days[0].label).toBeNull();
  });

  it('removes one day by its date', () => {
    const days = addDaysInYear(none, 2026, ['2026-01-01', '2026-01-02'], 'OFF', '').days;
    expect(removeDay(days, '2026-01-01').map((d) => d.date)).toEqual(['2026-01-02']);
  });
});

describe('the weekend', () => {
  it('Saturday and Sunday are off by default', () => {
    expect(DEFAULT_WEEKEND_DAYS).toEqual([0, 6]);
  });

  it('ticking a weekday adds it, in order; ticking it again removes it', () => {
    expect(toggleWeekendDay([0, 6], 5, true)).toEqual([0, 5, 6]);
    expect(toggleWeekendDay([0, 5, 6], 5, false)).toEqual([0, 6]);
  });
});

describe('the body of a save', () => {
  const state: CalendarEditState = {
    weekendDays: [0, 6],
    days: [{ date: '2026-09-02', kind: 'OFF', label: 'Quốc khánh' }, { date: '2026-09-05', kind: 'WORKING', label: null }],
    note: ' ',
  };

  it('a year with no row yet is saved with expected null', () => {
    expect(toSaveBody(state, null).expected).toBeNull();
  });

  it('a stored year is saved with the row and revision that were looked at', () => {
    expect(toSaveBody(state, { id: 'y1', revision: 3 }).expected).toEqual({ id: 'y1', revision: 3 });
  });

  it('sends every day with its kind, a label only when there is one, and no empty note', () => {
    const body = toSaveBody(state, null);
    expect(body.days).toEqual([{ date: '2026-09-02', kind: 'OFF', label: 'Quốc khánh' }, { date: '2026-09-05', kind: 'WORKING' }]);
    expect(body).not.toHaveProperty('note');
    expect(Object.keys(body).sort()).toEqual(['days', 'expected', 'weekendDays']);
  });

  it('sends the note when there is one', () => {
    expect(toSaveBody({ ...state, note: ' đã đối chiếu ' }, null).note).toBe('đã đối chiếu');
  });
});
