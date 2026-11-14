import * as fs from 'fs';
import * as path from 'path';
import { FIXED_SOLAR_HOLIDAYS, WORKING_CALENDAR_SEED_YEARS, workingCalendarSeedRows } from './seed-working-calendar';

/**
 * The working calendar is seeded in two places: the migration (a database that runs migrations) and
 * `seedWorkingCalendar` (a fresh database built by `db push`). This reads the migration's SQL and fails when the two
 * would not insert the same rows.
 */
const MIGRATION = path.join(__dirname, 'migrations', '20261116100000_proc_working_calendar', 'migration.sql');
const sql = fs.readFileSync(MIGRATION, 'utf8');

/** The rows the migration's two INSERT statements produce, worked out from its text. */
function migrationRows() {
  const yearTuples = [...sql.matchAll(/\('(proc_wcy_seed_\d{4})', (\d{4}), ARRAY\[([\d, ]+)\]::INTEGER\[\], '(\w+)', (\d+), NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP\)/g)];
  const holidays = [...sql.matchAll(/\('(\d{4})', (\d+), (\d+), '([^']+)'\)/g)].map((m) => ({
    monthDay: m[1],
    month: Number(m[2]),
    day: Number(m[3]),
    label: m[4],
  }));
  const seededYears = (/WHERE y\."year" IN \(([\d, ]+)\)/.exec(sql)?.[1] ?? '').split(',').map((n) => Number(n.trim()));
  const two = (n: number) => String(n).padStart(2, '0');
  return {
    seededYears,
    rows: yearTuples.map((m) => {
      const year = Number(m[2]);
      return {
        id: m[1],
        year,
        weekendDays: m[3].split(',').map((n) => Number(n.trim())),
        status: m[4],
        revision: Number(m[5]),
        // The day INSERT joins every year of its IN list with every holiday.
        days: seededYears.includes(year)
          ? holidays.map((h) => ({ id: `proc_wcd_seed_${year}_${h.monthDay}`, date: `${year}-${two(h.month)}-${two(h.day)}`, kind: 'OFF', label: h.label }))
          : [],
      };
    }),
  };
}

describe('the working calendar seed and the migration insert the same rows', () => {
  it('the migration has exactly the two INSERT statements this test reads, in the shape it reads them', () => {
    expect(sql.match(/INSERT INTO/g)).toHaveLength(2);
    expect(sql).toContain(`SELECT 'proc_wcd_seed_' || y."year" || '_' || h."monthDay",`);
    expect(sql).toContain(`make_date(y."year", h."month", h."day"),`);
    expect(sql).toContain(`'OFF'::"ProcCalendarDayKind",`);
    expect(sql).toContain('ON CONFLICT ("year") DO NOTHING;');
    expect(sql).toContain('ON CONFLICT ("yearId", "date") DO NOTHING;');
  });

  it('the test did read years and holidays out of the migration', () => {
    const { rows, seededYears } = migrationRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.days.length > 0)).toBe(true);
    expect(seededYears).toEqual(rows.map((row) => row.year));
    // In each holiday tuple the key of the id says the same month and day as the date.
    for (const row of rows) for (const day of row.days) expect(day.id.slice(-4)).toBe(day.date.slice(5).replace('-', ''));
  });

  it('the seed function writes exactly the rows of the migration: ids, years, weekend, status, revision, dates, kinds, labels', () => {
    expect(workingCalendarSeedRows()).toEqual(migrationRows().rows);
  });

  it('those are 2026 and 2027, DRAFT, with the four fixed solar holidays and nothing else', () => {
    expect([...WORKING_CALENDAR_SEED_YEARS]).toEqual([2026, 2027]);
    expect(FIXED_SOLAR_HOLIDAYS.map((h) => `${h.day}/${h.month}`)).toEqual(['1/1', '30/4', '1/5', '2/9']);
    for (const row of workingCalendarSeedRows()) {
      expect(row).toMatchObject({ status: 'DRAFT', revision: 1, weekendDays: [6, 0] });
      expect(row.days.map((day) => day.date)).toEqual([`${row.year}-01-01`, `${row.year}-04-30`, `${row.year}-05-01`, `${row.year}-09-02`]);
    }
  });

  it('for other years it makes the same shape with ids of their own', () => {
    const [row] = workingCalendarSeedRows([2190]);
    expect(row.id).toBe('proc_wcy_seed_2190');
    expect(row.days.map((day) => `${day.id} ${day.date}`)).toContain('proc_wcd_seed_2190_0430 2190-04-30');
  });
});

describe('where the seed is called from', () => {
  const read = (relative: string) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

  it('the fresh-database bootstrap seeds it after marking the migrations applied', () => {
    const source = read('src/legacy-migration/cli/bootstrap-fresh-db.ts');
    const main = source.slice(source.indexOf('async function main()'));
    const resolved = main.indexOf(`'migrate', 'resolve', '--applied'`);
    const seeded = main.indexOf('seedDataOfMigrations(');
    expect(resolved).toBeGreaterThan(-1);
    expect(seeded).toBeGreaterThan(resolved);
    const helper = source.slice(source.indexOf('export async function seedDataOfMigrations('), source.indexOf('async function main()'));
    expect(helper).toContain('await seedWorkingCalendar(prisma)');
  });

  it('`npm run db:seed` seeds it, before the step that stops when no admin password is given', () => {
    const source = read('prisma/seed.ts');
    const seeded = source.indexOf('await seedWorkingCalendar(prisma)');
    expect(seeded).toBeGreaterThan(-1);
    expect(seeded).toBeLessThan(source.indexOf('SEED_ADMIN_PASSWORD env var required'));
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
    expect(scripts['db:seed']).toBe('ts-node prisma/seed.ts');
  });
});
