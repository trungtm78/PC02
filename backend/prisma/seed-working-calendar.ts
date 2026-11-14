/**
 * Seed of the working calendar deadlines are counted on: the years 2026 and 2027 as DRAFT, with the FIXED solar public
 * holidays only (1 January, 30 April, 1 May, 2 September).
 *
 * Lunar new year, Hung Kings day, the second National Day holiday and every compensatory day are NOT here: those
 * depend on yearly government announcements and a person must enter them. That is also why both years stay DRAFT.
 *
 * The migration `20261116100000_proc_working_calendar` inserts the same rows on a database that runs migrations
 * (production: `prisma migrate deploy`). A FRESH database is built by `db push` with every migration marked applied,
 * so the migration's INSERTs never run there: this seeder is what fills it (`bootstrap-fresh-db.ts`, `npm run db:seed`).
 * `seed-working-calendar.spec.ts` fails when the two stop inserting the same rows.
 *
 * Idempotent, and it never overwrites: a year that already has a row (seeded before, or entered or edited by a
 * person) is left exactly as it is, days included.
 */
import type { PrismaClient } from '@prisma/client';

export const WORKING_CALENDAR_SEED_YEARS: readonly number[] = [2026, 2027];

/** The public holidays that fall on the same solar date every year. */
export const FIXED_SOLAR_HOLIDAYS: ReadonlyArray<{ month: number; day: number; label: string }> = [
  { month: 1, day: 1, label: 'Tết Dương lịch' },
  { month: 4, day: 30, label: 'Ngày Giải phóng miền Nam, thống nhất đất nước' },
  { month: 5, day: 1, label: 'Ngày Quốc tế Lao động' },
  { month: 9, day: 2, label: 'Ngày Quốc khánh' },
];

export interface WorkingCalendarSeedYear {
  id: string;
  year: number;
  /** JavaScript weekday numbers: 6 = Saturday, 0 = Sunday. */
  weekendDays: number[];
  status: 'DRAFT';
  revision: number;
  days: Array<{ id: string; date: string; kind: 'OFF'; label: string }>;
}

const two = (n: number): string => String(n).padStart(2, '0');

/** Exactly the rows the migration inserts, for the given years. */
export function workingCalendarSeedRows(years: readonly number[] = WORKING_CALENDAR_SEED_YEARS): WorkingCalendarSeedYear[] {
  return years.map((year) => ({
    id: `proc_wcy_seed_${year}`,
    year,
    weekendDays: [6, 0],
    status: 'DRAFT',
    revision: 1,
    days: FIXED_SOLAR_HOLIDAYS.map((holiday) => ({
      id: `proc_wcd_seed_${year}_${two(holiday.month)}${two(holiday.day)}`,
      date: `${year}-${two(holiday.month)}-${two(holiday.day)}`,
      kind: 'OFF',
      label: holiday.label,
    })),
  }));
}

/**
 * Creates each seed year that has no row yet, with its days; a year that has a row is skipped whole.
 * `years`: other years than the default ones (the database specs seed years of their own).
 */
export async function seedWorkingCalendar(
  prisma: PrismaClient,
  years: readonly number[] = WORKING_CALENDAR_SEED_YEARS,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const row of workingCalendarSeedRows(years)) {
    // By YEAR, not by id: a year a person entered has an id of its own and must be left alone just the same.
    const existing = await prisma.procWorkingCalendarYear.findUnique({ where: { year: row.year }, select: { id: true } });
    if (existing) {
      skipped++;
      continue;
    }
    try {
      await prisma.procWorkingCalendarYear.create({
        data: {
          id: row.id,
          year: row.year,
          weekendDays: row.weekendDays,
          status: row.status,
          revision: row.revision,
          days: {
            create: row.days.map((day) => ({ id: day.id, date: new Date(`${day.date}T00:00:00.000Z`), kind: day.kind, label: day.label })),
          },
        },
      });
      created++;
    } catch (error) {
      // Somebody entered the year between the look and the insert: then it is theirs.
      if ((error as { code?: string }).code !== 'P2002') throw error;
      skipped++;
    }
  }
  return { created, skipped };
}
