import { HttpException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomInt, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { AuditService } from '../../audit/audit.service';
import { openScratchDatabase, type ScratchDatabase } from '../../common/testing/scratch-database';
import { civilDayFromIso } from '../engine/civil-day';
import { computeDue } from '../engine/compute-due';
import { buildWorkingCalendar } from '../engine/working-calendar';
import { WorkingCalendarService, type CalendarDayInput } from './working-calendar.service';

/**
 * The working calendar on a REAL PostgreSQL: saving a year, the revision guard, confirming and its way back, a
 * confirmed year returning to DRAFT when its days change, the delete rules, the audit rows, and `load` as the deadline
 * engine reads it.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database. It works on twenty years of its own, far in the
 * future (a random run of twenty between 2200 and 8999), so that nothing collides with the seeded years or with another
 * suite; the rows of those years, its audit rows, its user and its role are removed at the end.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

// In CI a missing database is a failure, not a suite silently skipped.
if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

run('WorkingCalendarService on PostgreSQL', () => {
  jest.setTimeout(120_000);
  let scratch: ScratchDatabase;
  let calendars: WorkingCalendarService;
  const tag = `pwc-${randomUUID().slice(0, 8)}`;
  const firstYear = 2200 + randomInt(0, 340) * 20;
  const years = Array.from({ length: 20 }, (_, i) => firstYear + i);
  let next = 0;
  /** A year no other test of this suite has touched. */
  const freshYear = (): number => {
    if (next >= years.length - 1) throw new Error('this suite has only twenty years, the last one kept empty');
    return years[next++];
  };
  let actor = '';
  let other = '';
  let roleId = '';

  const codeOf = async (attempt: Promise<unknown>): Promise<{ status: number; code: unknown } | 'RESOLVED'> => {
    try {
      await attempt;
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      return { status: error.getStatus(), code: (error.getResponse() as { code?: unknown }).code };
    }
    return 'RESOLVED';
  };

  /** The audit rows about one year, oldest first (the column keeps milliseconds: the revision breaks a tie). */
  const auditRows = async (year: number) => {
    const rows = await scratch.db.auditLog.findMany({
      where: { subject: 'ProcWorkingCalendarYear', userId: { in: [actor, other] }, metadata: { path: ['year'], equals: year } },
    });
    const revisionOf = (row: (typeof rows)[number]) => Number((row.metadata as { revision?: number } | null)?.revision ?? 0);
    return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || revisionOf(a) - revisionOf(b));
  };

  const dropYears = async (): Promise<void> => {
    await scratch.db.procWorkingCalendarDay.deleteMany({ where: { year: { year: { in: years } } } });
    await scratch.db.procWorkingCalendarYear.deleteMany({ where: { year: { in: years } } });
  };

  const holidays = (year: number): CalendarDayInput[] => [
    { date: `${year}-01-01`, kind: 'OFF', label: 'New year' },
    { date: `${year}-04-30`, kind: 'OFF', label: null },
  ];

  beforeAll(async () => {
    scratch = await openScratchDatabase(url as string);
    const { db } = scratch;
    // Left by a run that was killed: the years are random, so this is almost always nothing.
    await dropYears();
    const role = await db.role.create({ data: { name: `${tag}-role` } });
    roleId = role.id;
    actor = (await db.user.create({ data: { username: `${tag}-actor`, passwordHash: 'x', roleId, isActive: true } })).id;
    other = (await db.user.create({ data: { username: `${tag}-other`, passwordHash: 'x', roleId, isActive: true } })).id;
    calendars = new WorkingCalendarService(db as never, new AuditService(db as never));
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    await dropYears();
    await db.auditLog.deleteMany({ where: { userId: { in: [actor, other] } } });
    await db.user.deleteMany({ where: { id: { in: [actor, other] } } });
    await db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  describe('a year with no row', () => {
    it('reads as nothing, and loads as weekends off, no holidays, not confirmed', async () => {
      const year = freshYear();
      expect(await calendars.getYear(year)).toBeNull();
      const calendar = await calendars.load(year, year);
      expect(calendar.isConfirmed(year)).toBe(false);
      expect(calendar.isWorkingDay(civilDayFromIso(`${year}-01-01`))).toBe(new Date(Date.UTC(year, 0, 1)).getUTCDay() % 6 !== 0);
      expect(calendar.version).toBe(buildWorkingCalendar([]).version);
    });
  });

  describe('saving a year', () => {
    it('creates it as a DRAFT at revision 1, with its days in date order, stored on the days that were sent', async () => {
      const year = freshYear();
      const saved = await calendars.saveYear(
        year,
        {
          weekendDays: [6, 0],
          days: [
            { date: `${year}-12-31`, kind: 'OFF', label: '  Year end  ' },
            { date: `${year}-01-01`, kind: 'OFF', label: '' },
            { date: `${year}-06-15`, kind: 'WORKING' },
          ],
          note: '  first entry ',
          expected: null,
        },
        actor,
      );
      expect(saved).toMatchObject({
        year,
        weekendDays: [6, 0],
        status: 'DRAFT',
        revision: 1,
        confirmedById: null,
        confirmedAt: null,
        note: 'first entry',
        updatedById: actor,
        days: [
          { date: `${year}-01-01`, kind: 'OFF', label: null },
          { date: `${year}-06-15`, kind: 'WORKING', label: null },
          { date: `${year}-12-31`, kind: 'OFF', label: 'Year end' },
        ],
      });
      expect(await calendars.getYear(year)).toEqual(saved);
      // The DATE column holds the calendar day itself: the first and the last day of the year did not slide.
      const stored = await scratch.pg.query<{ d: string }>(
        `SELECT to_char(d."date", 'YYYY-MM-DD') AS d FROM proc_working_calendar_days d JOIN proc_working_calendar_years y ON y.id = d."yearId" WHERE y.year = $1 ORDER BY d."date"`,
        [year],
      );
      expect(stored.rows.map((row) => row.d)).toEqual([`${year}-01-01`, `${year}-06-15`, `${year}-12-31`]);
    });

    it('a year that exists is not created again, and a year that does not exist has no revision to match', async () => {
      const year = freshYear();
      await calendars.saveYear(year, { weekendDays: [6, 0], days: holidays(year), expected: null }, actor);
      expect(await codeOf(calendars.saveYear(year, { weekendDays: [6, 0], days: [], expected: null }, other))).toEqual({
        status: 409,
        code: 'REVISION_CONFLICT',
      });
      const absent = freshYear();
      expect(await codeOf(calendars.saveYear(absent, { weekendDays: [6, 0], days: [], expected: { id: 'no-such-row', revision: 1 } }, actor))).toEqual({
        status: 409,
        code: 'REVISION_CONFLICT',
      });
      expect(await calendars.getYear(absent)).toBeNull();
      expect((await calendars.getYear(year))?.days).toHaveLength(2);
    });

    it('saving again replaces ALL the days and goes up one revision; a stale revision is refused and changes nothing', async () => {
      const year = freshYear();
      const first = await calendars.saveYear(year, { weekendDays: [6, 0], days: holidays(year), expected: null }, actor);
      const second = await calendars.saveYear(
        year,
        { weekendDays: [0], days: [{ date: `${year}-09-02`, kind: 'OFF', label: 'National day' }], note: 'second', expected: { id: first.id, revision: first.revision } },
        other,
      );
      expect(second).toMatchObject({
        id: first.id,
        revision: 2,
        status: 'DRAFT',
        weekendDays: [0],
        note: 'second',
        updatedById: other,
        days: [{ date: `${year}-09-02`, kind: 'OFF', label: 'National day' }],
      });
      expect(await scratch.db.procWorkingCalendarDay.count({ where: { yearId: first.id } })).toBe(1);

      expect(await codeOf(calendars.saveYear(year, { weekendDays: [6, 0], days: [], expected: { id: first.id, revision: first.revision } }, actor))).toEqual({
        status: 409,
        code: 'REVISION_CONFLICT',
      });
      expect(await calendars.getYear(year)).toEqual(second);
    });

    it('two people creating the same year at once: one is saved, the other is told the revision moved', async () => {
      const year = freshYear();
      const attempts = await Promise.all(
        [actor, other].map((who) => codeOf(calendars.saveYear(year, { weekendDays: [6, 0], days: holidays(year), expected: null }, who))),
      );
      expect(attempts.filter((result) => result === 'RESOLVED')).toHaveLength(1);
      expect(attempts.filter((result) => result !== 'RESOLVED')).toEqual([{ status: 409, code: 'REVISION_CONFLICT' }]);
      expect(await calendars.getYear(year)).toMatchObject({ revision: 1, days: [{ date: `${year}-01-01` }, { date: `${year}-04-30` }] });
    });

    it.each([
      ['a day of another year', (year: number) => ({ weekendDays: [6, 0], days: [{ date: `${year + 1}-01-01`, kind: 'OFF' as const }] }), 'CALENDAR_DAY_INVALID'],
      ['a day that does not exist', (year: number) => ({ weekendDays: [6, 0], days: [{ date: `${year}-02-30`, kind: 'OFF' as const }] }), 'CALENDAR_DAY_INVALID'],
      [
        'the same day twice',
        (year: number) => ({
          weekendDays: [6, 0],
          days: [
            { date: `${year}-05-01`, kind: 'OFF' as const },
            { date: `${year}-05-01`, kind: 'WORKING' as const },
          ],
        }),
        'CALENDAR_DAY_INVALID',
      ],
      ['an unknown kind', (year: number) => ({ weekendDays: [6, 0], days: [{ date: `${year}-05-01`, kind: 'HALF' as never }] }), 'CALENDAR_DAY_INVALID'],
      [
        'a label longer than 200 characters',
        (year: number) => ({ weekendDays: [6, 0], days: [{ date: `${year}-05-01`, kind: 'OFF' as const, label: 'x'.repeat(201) }] }),
        'CALENDAR_DAY_INVALID',
      ],
      ['a weekday number that does not exist', () => ({ weekendDays: [7], days: [] }), 'CALENDAR_WEEKEND_INVALID'],
      ['a week with no working day', () => ({ weekendDays: [0, 1, 2, 3, 4, 5, 6], days: [] }), 'CALENDAR_WEEKEND_INVALID'],
    ])('%s is refused with its code and nothing is written', async (_name, input, code) => {
      const year = years[years.length - 1];
      expect(await codeOf(calendars.saveYear(year, { ...input(year), expected: null }, actor))).toEqual({ status: 400, code });
      expect(await calendars.getYear(year)).toBeNull();
      expect(await auditRows(year)).toEqual([]);
    });

    it.each([1899, 10_000, 2190.5, Number.NaN])('the year %p is not a year', async (year) => {
      const refused = { status: 400, code: 'CALENDAR_YEAR_INVALID' };
      expect(await codeOf(calendars.saveYear(year, { weekendDays: [6, 0], days: [], expected: null }, actor))).toEqual(refused);
      expect(await codeOf(calendars.getYear(year))).toEqual(refused);
      expect(await codeOf(calendars.confirmYear(year, { id: 'no-such-row', revision: 1 }, actor))).toEqual(refused);
      expect(await codeOf(calendars.unconfirmYear(year, { id: 'no-such-row', revision: 1 }, actor))).toEqual(refused);
      expect(await codeOf(calendars.deleteYear(year, { id: 'no-such-row', revision: 1 }, actor))).toEqual(refused);
      expect(await codeOf(calendars.load(year, 2200))).toEqual(refused);
    });

    it('a write whose audit row cannot be written is not kept', async () => {
      const year = years[years.length - 1];
      const failing = { log: () => Promise.reject(new Error('audit down')) } as unknown as AuditService;
      const broken = new WorkingCalendarService(scratch.db as never, failing);
      await expect(broken.saveYear(year, { weekendDays: [6, 0], days: holidays(year), expected: null }, actor)).rejects.toThrow('audit down');
      expect(await calendars.getYear(year)).toBeNull();
      expect(await scratch.db.procWorkingCalendarDay.count({ where: { year: { year } } })).toBe(0);
    });
  });

  describe('confirming a year, and the way back', () => {
    let year = 0;
    let id = '';
    let revision = 0;
    /** What a writer sends: the row it looked at and the revision it saw. */
    const at = (seen = revision) => ({ id, revision: seen });

    beforeAll(async () => {
      year = freshYear();
      ({ id, revision } = await calendars.saveYear(year, { weekendDays: [6, 0], days: holidays(year), note: 'kept', expected: null }, actor));
    });

    it('a year that has no row cannot be confirmed, unconfirmed or deleted', async () => {
      const absent = years[years.length - 1];
      const notFound = { status: 404, code: 'CALENDAR_YEAR_NOT_FOUND' };
      expect(await codeOf(calendars.confirmYear(absent, { id: 'no-such-row', revision: 1 }, actor))).toEqual(notFound);
      expect(await codeOf(calendars.unconfirmYear(absent, { id: 'no-such-row', revision: 1 }, actor))).toEqual(notFound);
      expect(await codeOf(calendars.deleteYear(absent, { id: 'no-such-row', revision: 1 }, actor))).toEqual(notFound);
    });

    it('a stale revision cannot confirm', async () => {
      expect(await codeOf(calendars.confirmYear(year, at(revision + 5), actor))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
      expect((await calendars.getYear(year))?.status).toBe('DRAFT');
    });

    it('a draft cannot be unconfirmed', async () => {
      expect(await codeOf(calendars.unconfirmYear(year, at(), actor))).toEqual({ status: 409, code: 'CALENDAR_YEAR_NOT_CONFIRMED' });
    });

    it('confirming records who and when, keeps the days, and goes up one revision', async () => {
      const before = Date.now();
      const confirmed = await calendars.confirmYear(year, at(), other);
      expect(confirmed).toMatchObject({ status: 'CONFIRMED', revision: revision + 1, confirmedById: other, updatedById: other, note: 'kept' });
      expect(confirmed.days.map((day) => day.date)).toEqual([`${year}-01-01`, `${year}-04-30`]);
      expect(new Date(confirmed.confirmedAt as string).getTime()).toBeGreaterThanOrEqual(before - 1000);
      revision = confirmed.revision;
      expect((await calendars.load(year, year)).isConfirmed(year)).toBe(true);
    });

    it('a confirmed year is not confirmed twice', async () => {
      expect(await codeOf(calendars.confirmYear(year, at(), actor))).toEqual({ status: 409, code: 'CALENDAR_YEAR_ALREADY_CONFIRMED' });
    });

    it('a confirmed year cannot be deleted: it must be unconfirmed first', async () => {
      expect(await codeOf(calendars.deleteYear(year, at(), actor))).toEqual({ status: 409, code: 'CALENDAR_YEAR_CONFIRMED' });
      expect((await calendars.getYear(year))?.days).toHaveLength(2);
    });

    it('changing only a label or the note leaves it confirmed', async () => {
      const days: CalendarDayInput[] = [
        { date: `${year}-01-01`, kind: 'OFF', label: 'Renamed' },
        { date: `${year}-04-30`, kind: 'OFF', label: 'Named' },
      ];
      const saved = await calendars.saveYear(year, { weekendDays: [0, 6], days, note: 'reworded', expected: at() }, actor);
      expect(saved).toMatchObject({ status: 'CONFIRMED', confirmedById: other, revision: revision + 1, note: 'reworded' });
      expect(saved.days.map((day) => day.label)).toEqual(['Renamed', 'Named']);
      revision = saved.revision;
    });

    it('changing its days sends it back to DRAFT, and nobody has confirmed it any more', async () => {
      const saved = await calendars.saveYear(
        year,
        { weekendDays: [6, 0], days: [...holidays(year), { date: `${year}-05-01`, kind: 'OFF' }], note: 'reworded', expected: at() },
        actor,
      );
      expect(saved).toMatchObject({ status: 'DRAFT', confirmedById: null, confirmedAt: null, revision: revision + 1 });
      expect(saved.days).toHaveLength(3);
      revision = saved.revision;
      expect((await calendars.load(year, year)).isConfirmed(year)).toBe(false);
    });

    it('changing the kind of one day, or the weekly days off, does the same', async () => {
      revision = (await calendars.confirmYear(year, at(), actor)).revision;
      const kindChanged = holidays(year).map((day, i) => (i === 0 ? { ...day, kind: 'WORKING' as const } : day));
      const afterKind = await calendars.saveYear(
        year,
        { weekendDays: [6, 0], days: [...kindChanged, { date: `${year}-05-01`, kind: 'OFF' }], expected: at() },
        actor,
      );
      expect(afterKind.status).toBe('DRAFT');

      revision = (await calendars.confirmYear(year, at(afterKind.revision), actor)).revision;
      const afterWeekend = await calendars.saveYear(year, { weekendDays: [0], days: afterKind.days, expected: at() }, actor);
      expect(afterWeekend).toMatchObject({ status: 'DRAFT', confirmedById: null, confirmedAt: null, weekendDays: [0] });
      revision = afterWeekend.revision;
    });

    it('unconfirming is the way back: a draft again, the days untouched', async () => {
      revision = (await calendars.confirmYear(year, at(), actor)).revision;
      const daysBefore = (await calendars.getYear(year))?.days;
      expect(await codeOf(calendars.unconfirmYear(year, at(revision - 1), actor))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
      const draft = await calendars.unconfirmYear(year, at(), other);
      expect(draft).toMatchObject({ status: 'DRAFT', confirmedById: null, confirmedAt: null, revision: revision + 1, updatedById: other });
      expect(draft.days).toEqual(daysBefore);
      revision = draft.revision;
    });

    it('a draft is deleted with its days, only at the revision that was looked at', async () => {
      expect(await codeOf(calendars.deleteYear(year, at(revision - 1), actor))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
      expect(await calendars.getYear(year)).not.toBeNull();

      expect(await calendars.deleteYear(year, at(), actor)).toEqual({ deleted: true, year, id });
      expect(await calendars.getYear(year)).toBeNull();
      expect(await scratch.db.procWorkingCalendarDay.count({ where: { yearId: id } })).toBe(0);
      expect(await codeOf(calendars.deleteYear(year, at(), actor))).toEqual({ status: 404, code: 'CALENDAR_YEAR_NOT_FOUND' });
    });

    it('a deleted year can be entered again from nothing: a NEW row at revision 1, which the id of the old row no longer opens', async () => {
      const again = await calendars.saveYear(year, { weekendDays: [6, 0], days: [], expected: null }, actor);
      expect(again).toMatchObject({ revision: 1, status: 'DRAFT', days: [] });
      expect(again.id).not.toBe(id);
      // Somebody still holding the first row at ITS revision 1 is told it moved, although the number is 1 again.
      expect(await codeOf(calendars.saveYear(year, { weekendDays: [0], days: holidays(year), expected: { id, revision: 1 } }, other))).toEqual({
        status: 409,
        code: 'REVISION_CONFLICT',
      });
      expect(await calendars.getYear(year)).toEqual(again);
    });

    it('every write left one audit row, with metadata only; the refused ones left none', async () => {
      const rows = await auditRows(year);
      expect(rows.map((row) => row.action)).toEqual([
        'PROC_CALENDAR_YEAR_CREATE',
        'PROC_CALENDAR_YEAR_CONFIRM',
        'PROC_CALENDAR_YEAR_UPDATE', // labels and note
        'PROC_CALENDAR_YEAR_UPDATE', // a day added
        'PROC_CALENDAR_YEAR_CONFIRM',
        'PROC_CALENDAR_YEAR_UPDATE', // a kind changed
        'PROC_CALENDAR_YEAR_CONFIRM',
        'PROC_CALENDAR_YEAR_UPDATE', // the weekend changed
        'PROC_CALENDAR_YEAR_CONFIRM',
        'PROC_CALENDAR_YEAR_UNCONFIRM',
        'PROC_CALENDAR_YEAR_DELETE',
        'PROC_CALENDAR_YEAR_CREATE',
      ]);
      expect(rows[0]).toMatchObject({
        userId: actor,
        subject: 'ProcWorkingCalendarYear',
        metadata: { year, status: 'DRAFT', revision: 1, weekendDays: [6, 0], daysOff: 2, workingDays: 0 },
      });
      expect(rows[1]).toMatchObject({ userId: other, metadata: { status: 'CONFIRMED', revision: 2 } });
      expect(rows[2].metadata).toMatchObject({ status: 'CONFIRMED', daysChanged: false, backToDraft: false });
      expect(rows[3].metadata).toMatchObject({ status: 'DRAFT', daysChanged: true, backToDraft: true, daysOff: 3 });
      expect(rows[5].metadata).toMatchObject({ daysOff: 2, workingDays: 1, backToDraft: true });
      expect(rows[10].metadata).toMatchObject({ year, status: 'DRAFT' });
      // No label, no note: only which year, its state and counts.
      const text = JSON.stringify(rows.map((row) => row.metadata));
      for (const secret of ['Renamed', 'Named', 'New year', 'reworded', 'kept']) expect(text).not.toContain(secret);
      // Each row names the year row it was about.
      expect(new Set(rows.slice(0, 11).map((row) => row.subjectId)).size).toBe(1);
    });
  });

  describe('load, as the deadline engine reads it', () => {
    let confirmedYear = 0;
    let draftYear = 0;

    beforeAll(async () => {
      // Two years next to each other, so that a deadline can cross from one into the other.
      confirmedYear = freshYear();
      draftYear = freshYear();
      expect(draftYear).toBe(confirmedYear + 1);
      const saved = await calendars.saveYear(
        confirmedYear,
        {
          weekendDays: [6, 0],
          days: [
            { date: `${confirmedYear}-12-30`, kind: 'OFF', label: 'a day off' },
            { date: `${confirmedYear}-12-31`, kind: 'OFF', label: 'a day off' },
          ],
          expected: null,
        },
        actor,
      );
      await calendars.confirmYear(confirmedYear, saved, actor);
      await calendars.saveYear(draftYear, { weekendDays: [0], days: [{ date: `${draftYear}-01-01`, kind: 'OFF' }], expected: null }, actor);
    });

    it('holds both years: their days off, their weekends, which one is confirmed', async () => {
      const calendar = await calendars.load(confirmedYear, draftYear);
      expect(calendar.isConfirmed(confirmedYear)).toBe(true);
      expect(calendar.isConfirmed(draftYear)).toBe(false);
      expect(calendar.isWorkingDay(civilDayFromIso(`${confirmedYear}-12-30`))).toBe(false);
      expect(calendar.isWorkingDay(civilDayFromIso(`${confirmedYear}-12-31`))).toBe(false);
      expect(calendar.isWorkingDay(civilDayFromIso(`${draftYear}-01-01`))).toBe(false);
      // In the draft year only Sunday is off: every Saturday of its first fortnight works (unless it is 1 January).
      for (let d = 2; d <= 14; d++) {
        const iso = `${draftYear}-01-${String(d).padStart(2, '0')}`;
        expect({ iso, working: calendar.isWorkingDay(civilDayFromIso(iso)) }).toEqual({ iso, working: new Date(`${iso}T00:00:00Z`).getUTCDay() !== 0 });
      }
    });

    it('is the calendar the pure builder makes of the same data, version included', async () => {
      const expected = buildWorkingCalendar([
        {
          year: confirmedYear,
          weekendDays: [6, 0],
          status: 'CONFIRMED',
          days: [
            { date: `${confirmedYear}-12-30`, kind: 'OFF' },
            { date: `${confirmedYear}-12-31`, kind: 'OFF' },
          ],
        },
        { year: draftYear, weekendDays: [0], status: 'DRAFT', days: [{ date: `${draftYear}-01-01`, kind: 'OFF' }] },
      ]);
      const loaded = await calendars.load(confirmedYear, draftYear);
      expect(loaded.version).toBe(expected.version);
      // Loading one year only is another calendar: another version.
      expect((await calendars.load(confirmedYear, confirmedYear)).version).not.toBe(expected.version);
    });

    it('a deadline in working days that crosses into the draft year is provisional and carries the version', async () => {
      const calendar = await calendars.load(confirmedYear, draftYear);
      const anchor = { at: new Date(`${confirmedYear}-12-29T00:00:00.000Z`), hasTime: false };
      const result = computeDue({ anchor, value: 1, unit: 'WORKING_DAY', rollToWorkingDay: false, calendar });
      // 30 and 31 December and 1 January are off; then the first day that is not a Sunday.
      const second = new Date(`${draftYear}-01-02T00:00:00Z`).getUTCDay() === 0 ? '03' : '02';
      expect(result).toEqual({
        dueAt: new Date(`${draftYear}-01-${second}T16:59:59.999Z`),
        provisional: true,
        calendarVersion: calendar.version,
      });
    });

    it('a deadline that stays inside the confirmed year is final', async () => {
      const calendar = await calendars.load(confirmedYear, draftYear);
      const anchor = { at: new Date(`${confirmedYear}-03-01T00:00:00.000Z`), hasTime: false };
      expect(computeDue({ anchor, value: 10, unit: 'WORKING_DAY', rollToWorkingDay: false, calendar }).provisional).toBe(false);
    });

    it('inside a transaction it reads what that transaction wrote, and nothing is left when it rolls back', async () => {
      const rollback = new Error('rollback');
      const day = civilDayFromIso(`${draftYear}-01-01`);
      let insideWorking: boolean | undefined;
      await expect(
        scratch.db.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.procWorkingCalendarDay.deleteMany({ where: { year: { year: draftYear } } });
          insideWorking = (await calendars.load(draftYear, draftYear, tx)).isWorkingDay(day);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
      expect(insideWorking).toBe(new Date(`${draftYear}-01-01T00:00:00Z`).getUTCDay() !== 0);
      expect((await calendars.load(draftYear, draftYear)).isWorkingDay(day)).toBe(false);
    });

    it('a range that runs backwards is refused', async () => {
      expect(await codeOf(calendars.load(draftYear, confirmedYear))).toEqual({ status: 400, code: 'CALENDAR_YEAR_INVALID' });
    });
  });

  describe('the list of years', () => {
    it('every stored year with its state and how many exceptions of each kind, by year; no days', async () => {
      const [early, late] = [freshYear(), freshYear()].sort((a, b) => a - b);
      /** The second Saturday of January: a weekend day that is never the first of January. */
      const saturday = (year: number): string => {
        const first = new Date(Date.UTC(year, 0, 1)).getUTCDay();
        return `${year}-01-${String(8 + ((6 - first + 7) % 7)).padStart(2, '0')}`;
      };
      const lateRow = await calendars.saveYear(late, { weekendDays: [0], days: [{ date: `${late}-09-02`, kind: 'OFF' }], note: 'late', expected: null }, actor);
      const earlyRow = await calendars.saveYear(
        early,
        { weekendDays: [6, 0], days: [...holidays(early), { date: saturday(early), kind: 'WORKING', label: 'make-up day' }], expected: null },
        actor,
      );
      const confirmed = await calendars.confirmYear(early, earlyRow, other);

      const listed = (await calendars.listYears()).filter((row) => row.year === early || row.year === late);

      expect(listed).toEqual([
        {
          id: earlyRow.id,
          year: early,
          status: 'CONFIRMED',
          revision: 2,
          weekendDays: [6, 0],
          daysOff: 2,
          workingDays: 1,
          note: null,
          confirmedAt: confirmed.confirmedAt,
          confirmedById: other,
          updatedAt: confirmed.updatedAt,
        },
        {
          id: lateRow.id,
          year: late,
          status: 'DRAFT',
          revision: 1,
          weekendDays: [0],
          daysOff: 1,
          workingDays: 0,
          note: 'late',
          confirmedAt: null,
          confirmedById: null,
          updatedAt: lateRow.updatedAt,
        },
      ]);
      // By year, whatever else the database holds.
      const all = (await calendars.listYears()).map((row) => row.year);
      expect(all).toEqual([...all].sort((a, b) => a - b));
    });
  });

  describe('a year deleted and entered again is another generation', () => {
    let year = 0;
    /** The first row, as somebody saw it when it was a draft at revision 1, and when it was confirmed at revision 2. */
    let first = { id: '', revision: 0 };
    let replacement: Awaited<ReturnType<WorkingCalendarService['saveYear']>>;
    const refused = { status: 409, code: 'REVISION_CONFLICT' };

    beforeAll(async () => {
      year = freshYear();
      const created = await calendars.saveYear(year, { weekendDays: [6, 0], days: holidays(year), expected: null }, actor);
      first = { id: created.id, revision: created.revision };
      const confirmed = await calendars.confirmYear(year, created, actor);
      const draft = await calendars.unconfirmYear(year, confirmed, actor);
      await calendars.deleteYear(year, draft, actor);
      replacement = await calendars.saveYear(year, { weekendDays: [6, 0], days: [{ date: `${year}-09-02`, kind: 'OFF' }], expected: null }, actor);
    });

    it('the replacement is a new row, and its revision starts again at the number the first row once had', () => {
      expect(replacement.id).not.toBe(first.id);
      expect({ first: first.revision, replacement: replacement.revision }).toEqual({ first: 1, replacement: 1 });
    });

    it('a save that looked at the deleted row does not overwrite the replacement', async () => {
      const stale = calendars.saveYear(year, { weekendDays: [0], days: [], note: 'stale', expected: { id: first.id, revision: 1 } }, other);
      expect(await codeOf(stale)).toEqual(refused);
      expect(await calendars.getYear(year)).toEqual(replacement);
    });

    it('a confirmation that looked at the deleted row does not confirm the replacement', async () => {
      expect(await codeOf(calendars.confirmYear(year, { id: first.id, revision: 1 }, other))).toEqual(refused);
      expect(await calendars.getYear(year)).toEqual(replacement);
    });

    it('a deletion that looked at the deleted row does not delete the replacement', async () => {
      expect(await codeOf(calendars.deleteYear(year, { id: first.id, revision: 1 }, other))).toEqual(refused);
      expect(await calendars.getYear(year)).toEqual(replacement);
    });

    it('an unconfirmation that looked at the deleted row, confirmed at revision 2, leaves the replacement confirmed', async () => {
      const current = await calendars.getYear(year);
      if (!current) throw new Error('the replacement is gone');
      const confirmed = await calendars.confirmYear(year, current, actor);
      expect(confirmed).toMatchObject({ id: current.id, revision: 2, status: 'CONFIRMED' });
      expect(await codeOf(calendars.unconfirmYear(year, { id: first.id, revision: 2 }, other))).toEqual(refused);
      expect(await calendars.getYear(year)).toEqual(confirmed);
    });

    it('the right row at another revision is refused as well; the row and its revision together open it', async () => {
      const current = await calendars.getYear(year);
      if (!current) throw new Error('the replacement is gone');
      expect(await codeOf(calendars.unconfirmYear(year, { id: current.id, revision: current.revision - 1 }, actor))).toEqual(refused);
      expect(await codeOf(calendars.unconfirmYear(year, { id: '', revision: current.revision }, actor))).toEqual(refused);
      const draft = await calendars.unconfirmYear(year, { id: current.id, revision: current.revision }, actor);
      expect(draft).toMatchObject({ id: current.id, revision: current.revision + 1, status: 'DRAFT' });
    });

    it('none of the refused requests left an audit row', async () => {
      expect((await auditRows(year)).filter((row) => row.userId === other)).toEqual([]);
    });
  });

  describe('a reader never sees half of a save', () => {
    const dayOfMonth = (year: number, month: number, weekday: number): string => {
      const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
      return `${year}-${String(month).padStart(2, '0')}-${String(1 + ((weekday - first + 7) % 7)).padStart(2, '0')}`;
    };
    /** A Wednesday of the given month: a working day unless it is listed off. */
    const wednesdayOf = (year: number, month: number): string => dayOfMonth(year, month, 3);
    /** A Saturday: off under the default weekend, working when only Sunday is off. */
    const saturdayOf = (year: number, month: number): string => dayOfMonth(year, month, 6);
    const until = async (what: string, check: () => Promise<boolean>): Promise<void> => {
      const giveUpAt = Date.now() + 20_000;
      while (!(await check())) {
        if (Date.now() > giveUpAt) throw new Error(`timed out waiting for ${what}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    };

    /** The reader has connections of its own, named, so that the suite can see when THEY wait for a lock. */
    let reader: ScratchDatabase;
    let readerCalendars: WorkingCalendarService;
    const readerName = `${tag}-reader`;

    beforeAll(async () => {
      const target = new URL(url as string);
      target.searchParams.set('application_name', readerName);
      reader = await openScratchDatabase(target.toString());
      readerCalendars = new WorkingCalendarService(reader.db as never, new AuditService(reader.db as never));
    });

    afterAll(async () => {
      await reader?.close();
    });

    interface Seen {
      confirmed: boolean;
      /** Which of the two days in play are days off. */
      daysOff: string[];
    }

    const READERS: Array<[string, (year: number, days: string[]) => Promise<Seen>]> = [
      [
        'load',
        async (year, days) => {
          const calendar = await readerCalendars.load(year, year);
          return { confirmed: calendar.isConfirmed(year), daysOff: days.filter((day) => !calendar.isWorkingDay(civilDayFromIso(day))) };
        },
      ],
      [
        "load inside the caller's transaction",
        async (year, days) => {
          const calendar = await reader.db.$transaction((tx: Prisma.TransactionClient) => readerCalendars.load(year, year, tx));
          return { confirmed: calendar.isConfirmed(year), daysOff: days.filter((day) => !calendar.isWorkingDay(civilDayFromIso(day))) };
        },
      ],
      [
        'getYear',
        async (year, days) => {
          const stored = await readerCalendars.getYear(year);
          return { confirmed: stored?.status === 'CONFIRMED', daysOff: days.filter((day) => stored?.days.some((d) => d.date === day)) };
        },
      ],
    ];

    it.each(READERS)(
      '%s, held on the days while a save of other days commits: all of the old state or all of the new one, never the old CONFIRMED with the new days',
      async (_name, read) => {
        const year = freshYear();
        const [oldDay, newDay] = [wednesdayOf(year, 3), wednesdayOf(year, 4)];
        const saved = await calendars.saveYear(year, { weekendDays: [6, 0], days: [{ date: oldDay, kind: 'OFF' }], expected: null }, actor);
        await calendars.confirmYear(year, saved, actor);
        const oldState: Seen = { confirmed: true, daysOff: [oldDay] };
        const newState: Seen = { confirmed: false, daysOff: [newDay] };

        // A second session holds the days table: whoever reads the days waits, the years can still be read.
        const writer = new Client({ connectionString: url });
        await writer.connect();
        let seen: Seen;
        try {
          await writer.query('BEGIN');
          await writer.query('LOCK TABLE proc_working_calendar_days IN ACCESS EXCLUSIVE MODE');
          const reading = read(year, [oldDay, newDay]);
          // Kept from being an unhandled rejection while the suite is busy; it is awaited below.
          reading.catch(() => undefined);
          await until('the reader to wait for the days', async () => {
            const waiting = await scratch.pg.query(
              `SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock' AND state = 'active'`,
              [readerName],
            );
            return waiting.rowCount === 1;
          });
          // The same row changes `saveYear` makes for other days on a confirmed year: back to DRAFT, days replaced.
          await writer.query(
            `UPDATE proc_working_calendar_years SET status = 'DRAFT', "confirmedById" = NULL, "confirmedAt" = NULL, revision = revision + 1, "updatedAt" = now() WHERE id = $1`,
            [saved.id],
          );
          await writer.query(`DELETE FROM proc_working_calendar_days WHERE "yearId" = $1`, [saved.id]);
          await writer.query(`INSERT INTO proc_working_calendar_days (id, "yearId", "date", kind) VALUES ($1, $2, $3::date, 'OFF')`, [
            `${tag}-${year}-new`,
            saved.id,
            newDay,
          ]);
          await writer.query('COMMIT');
          seen = await reading;
        } finally {
          // Nothing to undo after the COMMIT; after a failure this releases the table.
          await writer.query('ROLLBACK').catch(() => undefined);
          await writer.end();
        }
        expect([oldState, newState]).toContainEqual(seen);
        // What is stored now is the new state, whole.
        expect(await read(year, [oldDay, newDay])).toEqual(newState);
      },
    );

    it('while real saves go back and forth between two states, every load is one of the two, whole', async () => {
      const year = freshYear();
      const [dayA, dayB, saturday] = [wednesdayOf(year, 3), wednesdayOf(year, 4), saturdayOf(year, 5)];
      const stateA = { weekendDays: [6, 0], days: [{ date: dayA, kind: 'OFF' as const }] };
      const stateB = { weekendDays: [0], days: [{ date: dayB, kind: 'OFF' as const }] };
      let held = await calendars.saveYear(year, { ...stateA, expected: null }, actor);

      let writing = true;
      const mixed: string[] = [];
      let reads = 0;
      const readLoop = async (): Promise<void> => {
        while (writing) {
          const calendar = await readerCalendars.load(year, year);
          const working = (day: string) => calendar.isWorkingDay(civilDayFromIso(day));
          // The weekend comes from the year row, the days off from the day rows.
          const seen = `saturday ${working(saturday) ? 'works' : 'off'}; off: ${[dayA, dayB].filter((day) => !working(day)).join(',')}`;
          if (seen !== `saturday off; off: ${dayA}` && seen !== `saturday works; off: ${dayB}`) mixed.push(seen);
          reads++;
        }
      };
      const readers = [readLoop(), readLoop(), readLoop()];
      try {
        for (let round = 0; round < 30; round++) {
          held = await calendars.saveYear(year, { ...(round % 2 === 0 ? stateB : stateA), expected: held }, actor);
        }
      } finally {
        writing = false;
        await Promise.all(readers);
      }
      expect(reads).toBeGreaterThan(0);
      expect(mixed).toEqual([]);
    });
  });
});
