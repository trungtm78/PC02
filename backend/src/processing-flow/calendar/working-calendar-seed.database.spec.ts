import { randomInt, randomUUID } from 'node:crypto';
import { seedWorkingCalendar, WORKING_CALENDAR_SEED_YEARS, workingCalendarSeedRows } from '../../../prisma/seed-working-calendar';
import { AuditService } from '../../audit/audit.service';
import { openScratchDatabase, type ScratchDatabase } from '../../common/testing/scratch-database';
import { seedDataOfMigrations } from '../../legacy-migration/cli/bootstrap-fresh-db';
import { civilDayFromIso } from '../engine/civil-day';
import { computeDue } from '../engine/compute-due';
import { WorkingCalendarService } from './working-calendar.service';

/**
 * The seed of the working calendar on a REAL PostgreSQL: what it writes, that a second run changes nothing, that a
 * year a person already entered or edited is left alone, and that the fresh-database bootstrap seeds the real years.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database. Except for the bootstrap test it seeds three
 * years of its own (a random run between 9000 and 9998, away from the years of the service's suite); everything it
 * creates is removed at the end. The bootstrap test works on the real seed years and removes only what IT created.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

// In CI a missing database is a failure, not a suite silently skipped.
if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

run('seedWorkingCalendar on PostgreSQL', () => {
  jest.setTimeout(120_000);
  let scratch: ScratchDatabase;
  const tag = `pws-${randomUUID().slice(0, 8)}`;
  const firstYear = 9000 + randomInt(0, 333) * 3;
  const [untouched, edited, emptied] = [firstYear, firstYear + 1, firstYear + 2];
  const own = [untouched, edited, emptied];
  let actor = '';
  let roleId = '';

  /** Every column of the years and their days, as stored. */
  const stored = async (years: readonly number[]) => {
    const result = await scratch.pg.query(
      `SELECT y."id", y."year", y."weekendDays", y."status"::text AS "status", y."revision", y."confirmedById", y."confirmedAt", y."note",
              y."updatedById", y."createdAt", y."updatedAt",
              COALESCE((SELECT json_agg(json_build_object('id', d."id", 'date', to_char(d."date", 'YYYY-MM-DD'), 'kind', d."kind"::text, 'label', d."label") ORDER BY d."date")
                        FROM proc_working_calendar_days d WHERE d."yearId" = y."id"), '[]'::json) AS "days"
       FROM proc_working_calendar_years y WHERE y."year" = ANY($1::int[]) ORDER BY y."year"`,
      [years],
    );
    return result.rows as Array<Record<string, unknown> & { year: number }>;
  };
  /** The same, reduced to the columns the seed decides. */
  const seededColumns = (rows: Awaited<ReturnType<typeof stored>>) =>
    rows.map(({ id, year, weekendDays, status, revision, days }) => ({ id, year, weekendDays, status, revision, days }));

  const drop = async (years: readonly number[]): Promise<void> => {
    await scratch.db.procWorkingCalendarDay.deleteMany({ where: { year: { year: { in: [...years] } } } });
    await scratch.db.procWorkingCalendarYear.deleteMany({ where: { year: { in: [...years] } } });
  };

  beforeAll(async () => {
    scratch = await openScratchDatabase(url as string);
    await drop(own);
    const role = await scratch.db.role.create({ data: { name: `${tag}-role` } });
    roleId = role.id;
    actor = (await scratch.db.user.create({ data: { username: `${tag}-actor`, passwordHash: 'x', roleId, isActive: true } })).id;
  });

  afterAll(async () => {
    if (!scratch) return;
    await drop(own);
    await scratch.db.auditLog.deleteMany({ where: { userId: actor } });
    await scratch.db.user.deleteMany({ where: { id: actor } });
    await scratch.db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  it('writes the rows of the migration for a year that has none: a DRAFT at revision 1 with the four fixed holidays', async () => {
    expect(await seedWorkingCalendar(scratch.db, [untouched])).toEqual({ created: 1, skipped: 0 });
    const rows = await stored([untouched]);
    expect(seededColumns(rows)).toEqual(workingCalendarSeedRows([untouched]));
    expect(rows[0]).toMatchObject({ confirmedById: null, confirmedAt: null, note: null, updatedById: null });
    expect((rows[0].days as Array<{ date: string }>).map((day) => day.date)).toEqual([
      `${untouched}-01-01`,
      `${untouched}-04-30`,
      `${untouched}-05-01`,
      `${untouched}-09-02`,
    ]);
  });

  it('the service reads a seeded year like any other, and a person can go on from it', async () => {
    const calendars = new WorkingCalendarService(scratch.db as never, new AuditService(scratch.db as never));
    const year = await calendars.getYear(untouched);
    expect(year).toMatchObject({ id: `proc_wcy_seed_${untouched}`, revision: 1, status: 'DRAFT' });
    const calendar = await calendars.load(untouched, untouched);
    expect(calendar.isWorkingDay(civilDayFromIso(`${untouched}-04-30`))).toBe(false);
    expect(calendar.isWorkingDay(civilDayFromIso(`${untouched}-05-01`))).toBe(false);
    expect(calendar.isConfirmed(untouched)).toBe(false);
  });

  it('running it again changes nothing: no row added, no column touched', async () => {
    const before = await stored([untouched]);
    expect(await seedWorkingCalendar(scratch.db, [untouched])).toEqual({ created: 0, skipped: 1 });
    expect(await seedWorkingCalendar(scratch.db, [untouched])).toEqual({ created: 0, skipped: 1 });
    expect(await stored([untouched])).toEqual(before);
  });

  it('a year somebody already entered, edited and confirmed is left exactly as it is; the missing year next to it is still seeded', async () => {
    const calendars = new WorkingCalendarService(scratch.db as never, new AuditService(scratch.db as never));
    const entered = await calendars.saveYear(
      edited,
      {
        weekendDays: [0],
        days: [
          { date: `${edited}-01-01`, kind: 'OFF', label: 'entered by a person' },
          { date: `${edited}-02-10`, kind: 'OFF', label: 'lunar new year, entered by a person' },
        ],
        note: 'ours',
        expected: null,
      },
      actor,
    );
    await calendars.confirmYear(edited, entered, actor);
    const before = await stored([edited]);

    expect(await seedWorkingCalendar(scratch.db, [edited, emptied])).toEqual({ created: 1, skipped: 1 });
    expect(await stored([edited])).toEqual(before);
    expect(before[0]).toMatchObject({ status: 'CONFIRMED', revision: 2, weekendDays: [0], note: 'ours' });
    // 30 April, 1 May and 2 September were NOT added to the year a person is responsible for.
    expect((before[0].days as Array<{ date: string }>).map((day) => day.date)).toEqual([`${edited}-01-01`, `${edited}-02-10`]);
    expect(seededColumns(await stored([emptied]))).toEqual(workingCalendarSeedRows([emptied]));
  });

  it('a seeded year from which a person removed every day stays empty', async () => {
    const calendars = new WorkingCalendarService(scratch.db as never, new AuditService(scratch.db as never));
    const seeded = await calendars.getYear(emptied);
    if (!seeded) throw new Error('the year was not seeded');
    await calendars.saveYear(emptied, { weekendDays: [6, 0], days: [], expected: seeded }, actor);
    const before = await stored([emptied]);
    expect(await seedWorkingCalendar(scratch.db, [emptied])).toEqual({ created: 0, skipped: 1 });
    expect(await stored([emptied])).toEqual(before);
    expect(before[0].days).toEqual([]);
  });

  describe('the fresh-database bootstrap, on the real seed years', () => {
    let existedBefore: number[] = [];
    let before: Awaited<ReturnType<typeof stored>> = [];

    beforeAll(async () => {
      before = await stored(WORKING_CALENDAR_SEED_YEARS);
      existedBefore = before.map((row) => row.year);
    });

    afterAll(async () => {
      // Only what this suite created: a year that was there (seeded by the migration, or a person's) stays.
      await drop(WORKING_CALENDAR_SEED_YEARS.filter((year) => !existedBefore.includes(year)));
    });

    it('seeds every seed year that has no row, with the rows of the migration, and leaves the others as they were', async () => {
      const result = await seedDataOfMigrations(scratch.db);
      const missing = WORKING_CALENDAR_SEED_YEARS.filter((year) => !existedBefore.includes(year));
      expect(result).toEqual({ workingCalendar: { created: missing.length, skipped: existedBefore.length } });
      expect(seededColumns(await stored(missing))).toEqual(workingCalendarSeedRows(missing));
      expect(await stored(existedBefore)).toEqual(before);
      expect((await stored(WORKING_CALENDAR_SEED_YEARS)).map((row) => row.year)).toEqual([...WORKING_CALENDAR_SEED_YEARS]);
    });

    it('a second bootstrap seed changes nothing', async () => {
      const first = await stored(WORKING_CALENDAR_SEED_YEARS);
      expect(await seedDataOfMigrations(scratch.db)).toEqual({ workingCalendar: { created: 0, skipped: WORKING_CALENDAR_SEED_YEARS.length } });
      expect(await stored(WORKING_CALENDAR_SEED_YEARS)).toEqual(first);
    });

    it('the reported case: 29 April 2026 plus one working day is 4 May, as on a migrated database (when nobody changed 2026)', async () => {
      const calendars = new WorkingCalendarService(scratch.db as never, new AuditService(scratch.db as never));
      const [year2026] = seededColumns(await stored([2026]));
      // Meaningful only while 2026 holds the seed rows; a scratch database on which somebody edited 2026 says so.
      expect(year2026).toEqual(workingCalendarSeedRows([2026])[0]);
      const calendar = await calendars.load(2026, 2026);
      const due = computeDue({
        anchor: { at: new Date('2026-04-29T00:00:00.000Z'), hasTime: false },
        value: 1,
        unit: 'WORKING_DAY',
        rollToWorkingDay: false,
        calendar,
      });
      expect(due.dueAt).toEqual(new Date('2026-05-04T16:59:59.999Z'));
      expect(due.provisional).toBe(true);
    });
  });
});
