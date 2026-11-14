import { HttpException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomInt, randomUUID } from 'node:crypto';
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
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database. It works on ten years of its own, far in the
 * future (a random decade between 2200 and 8990), so that nothing collides with the seeded years or with another
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
  const decade = 2200 + randomInt(0, 680) * 10;
  const years = Array.from({ length: 10 }, (_, i) => decade + i);
  let next = 0;
  /** A year no other test of this suite has touched. */
  const freshYear = (): number => {
    if (next >= years.length) throw new Error('this suite has only ten years');
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
    // Left by a run that was killed: the decade is random, so this is almost always nothing.
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
          expectedRevision: null,
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
      await calendars.saveYear(year, { weekendDays: [6, 0], days: holidays(year), expectedRevision: null }, actor);
      expect(await codeOf(calendars.saveYear(year, { weekendDays: [6, 0], days: [], expectedRevision: null }, other))).toEqual({
        status: 409,
        code: 'REVISION_CONFLICT',
      });
      const absent = freshYear();
      expect(await codeOf(calendars.saveYear(absent, { weekendDays: [6, 0], days: [], expectedRevision: 1 }, actor))).toEqual({
        status: 409,
        code: 'REVISION_CONFLICT',
      });
      expect(await calendars.getYear(absent)).toBeNull();
      expect((await calendars.getYear(year))?.days).toHaveLength(2);
    });

    it('saving again replaces ALL the days and goes up one revision; a stale revision is refused and changes nothing', async () => {
      const year = freshYear();
      const first = await calendars.saveYear(year, { weekendDays: [6, 0], days: holidays(year), expectedRevision: null }, actor);
      const second = await calendars.saveYear(
        year,
        { weekendDays: [0], days: [{ date: `${year}-09-02`, kind: 'OFF', label: 'National day' }], note: 'second', expectedRevision: first.revision },
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

      expect(await codeOf(calendars.saveYear(year, { weekendDays: [6, 0], days: [], expectedRevision: first.revision }, actor))).toEqual({
        status: 409,
        code: 'REVISION_CONFLICT',
      });
      expect(await calendars.getYear(year)).toEqual(second);
    });

    it('two people creating the same year at once: one is saved, the other is told the revision moved', async () => {
      const year = freshYear();
      const attempts = await Promise.all(
        [actor, other].map((who) => codeOf(calendars.saveYear(year, { weekendDays: [6, 0], days: holidays(year), expectedRevision: null }, who))),
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
      expect(await codeOf(calendars.saveYear(year, { ...input(year), expectedRevision: null }, actor))).toEqual({ status: 400, code });
      expect(await calendars.getYear(year)).toBeNull();
      expect(await auditRows(year)).toEqual([]);
    });

    it.each([1899, 10_000, 2190.5, Number.NaN])('the year %p is not a year', async (year) => {
      const refused = { status: 400, code: 'CALENDAR_YEAR_INVALID' };
      expect(await codeOf(calendars.saveYear(year, { weekendDays: [6, 0], days: [], expectedRevision: null }, actor))).toEqual(refused);
      expect(await codeOf(calendars.getYear(year))).toEqual(refused);
      expect(await codeOf(calendars.confirmYear(year, 1, actor))).toEqual(refused);
      expect(await codeOf(calendars.unconfirmYear(year, 1, actor))).toEqual(refused);
      expect(await codeOf(calendars.deleteYear(year, 1, actor))).toEqual(refused);
      expect(await codeOf(calendars.load(year, 2200))).toEqual(refused);
    });

    it('a write whose audit row cannot be written is not kept', async () => {
      const year = years[years.length - 1];
      const failing = { log: () => Promise.reject(new Error('audit down')) } as unknown as AuditService;
      const broken = new WorkingCalendarService(scratch.db as never, failing);
      await expect(broken.saveYear(year, { weekendDays: [6, 0], days: holidays(year), expectedRevision: null }, actor)).rejects.toThrow('audit down');
      expect(await calendars.getYear(year)).toBeNull();
      expect(await scratch.db.procWorkingCalendarDay.count({ where: { year: { year } } })).toBe(0);
    });
  });

  describe('confirming a year, and the way back', () => {
    let year = 0;
    let revision = 0;

    beforeAll(async () => {
      year = freshYear();
      revision = (await calendars.saveYear(year, { weekendDays: [6, 0], days: holidays(year), note: 'kept', expectedRevision: null }, actor)).revision;
    });

    it('a year that has no row cannot be confirmed, unconfirmed or deleted', async () => {
      const absent = years[years.length - 1];
      const notFound = { status: 404, code: 'CALENDAR_YEAR_NOT_FOUND' };
      expect(await codeOf(calendars.confirmYear(absent, 1, actor))).toEqual(notFound);
      expect(await codeOf(calendars.unconfirmYear(absent, 1, actor))).toEqual(notFound);
      expect(await codeOf(calendars.deleteYear(absent, 1, actor))).toEqual(notFound);
    });

    it('a stale revision cannot confirm', async () => {
      expect(await codeOf(calendars.confirmYear(year, revision + 5, actor))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
      expect((await calendars.getYear(year))?.status).toBe('DRAFT');
    });

    it('a draft cannot be unconfirmed', async () => {
      expect(await codeOf(calendars.unconfirmYear(year, revision, actor))).toEqual({ status: 409, code: 'CALENDAR_YEAR_NOT_CONFIRMED' });
    });

    it('confirming records who and when, keeps the days, and goes up one revision', async () => {
      const before = Date.now();
      const confirmed = await calendars.confirmYear(year, revision, other);
      expect(confirmed).toMatchObject({ status: 'CONFIRMED', revision: revision + 1, confirmedById: other, updatedById: other, note: 'kept' });
      expect(confirmed.days.map((day) => day.date)).toEqual([`${year}-01-01`, `${year}-04-30`]);
      expect(new Date(confirmed.confirmedAt as string).getTime()).toBeGreaterThanOrEqual(before - 1000);
      revision = confirmed.revision;
      expect((await calendars.load(year, year)).isConfirmed(year)).toBe(true);
    });

    it('a confirmed year is not confirmed twice', async () => {
      expect(await codeOf(calendars.confirmYear(year, revision, actor))).toEqual({ status: 409, code: 'CALENDAR_YEAR_ALREADY_CONFIRMED' });
    });

    it('a confirmed year cannot be deleted: it must be unconfirmed first', async () => {
      expect(await codeOf(calendars.deleteYear(year, revision, actor))).toEqual({ status: 409, code: 'CALENDAR_YEAR_CONFIRMED' });
      expect((await calendars.getYear(year))?.days).toHaveLength(2);
    });

    it('changing only a label or the note leaves it confirmed', async () => {
      const days: CalendarDayInput[] = [
        { date: `${year}-01-01`, kind: 'OFF', label: 'Renamed' },
        { date: `${year}-04-30`, kind: 'OFF', label: 'Named' },
      ];
      const saved = await calendars.saveYear(year, { weekendDays: [0, 6], days, note: 'reworded', expectedRevision: revision }, actor);
      expect(saved).toMatchObject({ status: 'CONFIRMED', confirmedById: other, revision: revision + 1, note: 'reworded' });
      expect(saved.days.map((day) => day.label)).toEqual(['Renamed', 'Named']);
      revision = saved.revision;
    });

    it('changing its days sends it back to DRAFT, and nobody has confirmed it any more', async () => {
      const saved = await calendars.saveYear(
        year,
        { weekendDays: [6, 0], days: [...holidays(year), { date: `${year}-05-01`, kind: 'OFF' }], note: 'reworded', expectedRevision: revision },
        actor,
      );
      expect(saved).toMatchObject({ status: 'DRAFT', confirmedById: null, confirmedAt: null, revision: revision + 1 });
      expect(saved.days).toHaveLength(3);
      revision = saved.revision;
      expect((await calendars.load(year, year)).isConfirmed(year)).toBe(false);
    });

    it('changing the kind of one day, or the weekly days off, does the same', async () => {
      revision = (await calendars.confirmYear(year, revision, actor)).revision;
      const kindChanged = holidays(year).map((day, i) => (i === 0 ? { ...day, kind: 'WORKING' as const } : day));
      const afterKind = await calendars.saveYear(
        year,
        { weekendDays: [6, 0], days: [...kindChanged, { date: `${year}-05-01`, kind: 'OFF' }], expectedRevision: revision },
        actor,
      );
      expect(afterKind.status).toBe('DRAFT');

      revision = (await calendars.confirmYear(year, afterKind.revision, actor)).revision;
      const afterWeekend = await calendars.saveYear(year, { weekendDays: [0], days: afterKind.days, expectedRevision: revision }, actor);
      expect(afterWeekend).toMatchObject({ status: 'DRAFT', confirmedById: null, confirmedAt: null, weekendDays: [0] });
      revision = afterWeekend.revision;
    });

    it('unconfirming is the way back: a draft again, the days untouched', async () => {
      revision = (await calendars.confirmYear(year, revision, actor)).revision;
      const daysBefore = (await calendars.getYear(year))?.days;
      expect(await codeOf(calendars.unconfirmYear(year, revision - 1, actor))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
      const draft = await calendars.unconfirmYear(year, revision, other);
      expect(draft).toMatchObject({ status: 'DRAFT', confirmedById: null, confirmedAt: null, revision: revision + 1, updatedById: other });
      expect(draft.days).toEqual(daysBefore);
      revision = draft.revision;
    });

    it('a draft is deleted with its days, only at the revision that was looked at', async () => {
      const id = (await calendars.getYear(year))?.id as string;
      expect(await codeOf(calendars.deleteYear(year, revision - 1, actor))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
      expect(await calendars.getYear(year)).not.toBeNull();

      expect(await calendars.deleteYear(year, revision, actor)).toEqual({ deleted: true, year });
      expect(await calendars.getYear(year)).toBeNull();
      expect(await scratch.db.procWorkingCalendarDay.count({ where: { yearId: id } })).toBe(0);
      expect(await codeOf(calendars.deleteYear(year, revision, actor))).toEqual({ status: 404, code: 'CALENDAR_YEAR_NOT_FOUND' });
    });

    it('a deleted year can be entered again from nothing', async () => {
      const again = await calendars.saveYear(year, { weekendDays: [6, 0], days: [], expectedRevision: null }, actor);
      expect(again).toMatchObject({ revision: 1, status: 'DRAFT', days: [] });
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
          expectedRevision: null,
        },
        actor,
      );
      await calendars.confirmYear(confirmedYear, saved.revision, actor);
      await calendars.saveYear(draftYear, { weekendDays: [0], days: [{ date: `${draftYear}-01-01`, kind: 'OFF' }], expectedRevision: null }, actor);
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
});
