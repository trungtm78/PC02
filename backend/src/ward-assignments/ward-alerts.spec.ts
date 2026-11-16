import { ALERT_LEVELS, alertOf, alertWhere } from './ward-alerts';
import { wordsPattern } from './ward-matching.service';

describe('wordsPattern: a name taken literally, as whole words', () => {
  const words = (name: string) => new RegExp(wordsPattern(name));
  it('keeps punctuation of the name (Y-Hen Niê)', () => {
    expect(words('y-hen nie').test(' y-hen nie va dong bon')).toBe(true);
  });
  it('a dot is a dot, not any character', () => {
    expect(words('ng. van a').test(' ngx van a')).toBe(false);
    expect(words('ng. van a').test(' ng. van a')).toBe(true);
  });
  it('part of a longer word is not the name', () => {
    expect(words('nguyen van teo').test(' nguyen van teong')).toBe(false);
  });
});
import { vnDay } from './ward-review.rules';

/**
 * The deadline alert of a request. Expected values from the plan (section 6, P1): yellow when 7 days or fewer are
 * left, red when 3 or fewer, "Quá hạn" once the deadline has passed, nothing once completed; days on the Viet Nam
 * calendar.
 */
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const approved = (due: string | null, completed: string | null = null) => ({ status: 'APPROVED', resultDueOn: due ? day(due) : null, completedOn: completed ? day(completed) : null });

describe('alertOf', () => {
  const today = day('2026-11-20');

  it.each([
    ['2026-11-28', 'NONE', 8],
    ['2026-11-27', 'YELLOW', 7],
    ['2026-11-24', 'YELLOW', 4],
    ['2026-11-23', 'RED', 3],
    ['2026-11-21', 'RED', 1],
    ['2026-11-20', 'RED', 0],
    ['2026-11-19', 'OVERDUE', -1],
    ['2026-10-20', 'OVERDUE', -31],
  ])('due %s → %s (%d days left)', (due, level, daysLeft) => {
    expect(alertOf(approved(due), today)).toEqual({ level, dueOn: due, daysLeft });
  });

  it('completed: DONE whatever the deadline (even long past), no days left', () => {
    expect(alertOf(approved('2026-10-01', '2026-11-01'), today)).toEqual({ level: 'DONE', dueOn: '2026-10-01', daysLeft: null });
  });

  it('not approved, or approved without a deadline: NONE', () => {
    expect(alertOf({ status: 'SUBMITTED', resultDueOn: null, completedOn: null }, today).level).toBe('NONE');
    expect(alertOf({ status: 'RETURNED', resultDueOn: day('2026-11-01'), completedOn: null }, today).level).toBe('NONE');
    expect(alertOf(approved(null), today)).toEqual({ level: 'NONE', dueOn: null, daysLeft: null });
  });

  it('"today" is the day in Viet Nam: 16:59:59 UTC is still the 20th, 17:00 UTC is the 21st', () => {
    const due = approved('2026-11-27');
    expect(alertOf(due, vnDay(new Date('2026-11-20T16:59:59.999Z')))).toMatchObject({ level: 'YELLOW', daysLeft: 7 });
    expect(alertOf(due, vnDay(new Date('2026-11-20T17:00:00.000Z')))).toMatchObject({ level: 'YELLOW', daysLeft: 6 });
    const dueToday = approved('2026-11-20');
    expect(alertOf(dueToday, vnDay(new Date('2026-11-20T16:59:59.999Z'))).level).toBe('RED');
    expect(alertOf(dueToday, vnDay(new Date('2026-11-20T17:00:00.000Z'))).level).toBe('OVERDUE');
  });
});

describe('alertWhere: one condition per level, the same rule as alertOf', () => {
  it('names every level', () => {
    for (const level of ALERT_LEVELS) expect(alertWhere(level, day('2026-11-20'))).toBeTruthy();
  });

  it('the bounds of the levels are the days alertOf switches on', () => {
    const today = day('2026-11-20');
    expect(alertWhere('RED', today)).toEqual({ status: 'APPROVED', completedOn: null, resultDueOn: { gte: today, lte: day('2026-11-23') } });
    expect(alertWhere('YELLOW', today)).toEqual({ status: 'APPROVED', completedOn: null, resultDueOn: { gt: day('2026-11-23'), lte: day('2026-11-27') } });
    expect(alertWhere('OVERDUE', today)).toEqual({ status: 'APPROVED', completedOn: null, resultDueOn: { lt: today } });
  });
});
