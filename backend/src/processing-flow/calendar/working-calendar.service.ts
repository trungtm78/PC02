import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PROCESSING_ERROR } from '../contract/processing-codes';
import { ProcessingEngineError } from '../engine/errors';
import type { CalendarDayKind, CalendarYearStatus } from '../engine/types';
import {
  buildWorkingCalendar,
  checkCalendarYear,
  MAX_CALENDAR_YEAR,
  MIN_CALENDAR_YEAR,
  type WorkingCalendar,
  type WorkingCalendarYearData,
} from '../engine/working-calendar';

export interface CalendarDayInput {
  /** `YYYY-MM-DD`, a day of the year being saved. */
  date: string;
  kind: CalendarDayKind;
  label?: string | null;
}

/**
 * What a writer looked at: WHICH row of the year (a year that was deleted and entered again is another row, whose
 * revision starts again at 1) and at which revision. Every read and write returns both.
 */
export interface CalendarYearExpectation {
  id: string;
  revision: number;
}

export interface CalendarYearSaveInput {
  /** JavaScript weekday numbers off every week: 0 = Sunday ... 6 = Saturday. */
  weekendDays: number[];
  /** ALL the exceptions of the year: what is not listed here is removed. */
  days: CalendarDayInput[];
  note?: string | null;
  /** The row and revision the writer looked at; `null` = "this year has no row yet". */
  expected: CalendarYearExpectation | null;
}

export interface CalendarYearDto {
  id: string;
  year: number;
  weekendDays: number[];
  status: CalendarYearStatus;
  revision: number;
  confirmedById: string | null;
  confirmedAt: string | null;
  note: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  /** By date. */
  days: Array<{ date: string; kind: CalendarDayKind; label: string | null }>;
}

/** A stored year without its days: one line of the list of years. */
export interface CalendarYearSummaryDto {
  id: string;
  year: number;
  weekendDays: number[];
  status: CalendarYearStatus;
  revision: number;
  /** How many exceptions of each kind the year holds. */
  daysOff: number;
  workingDays: number;
  note: string | null;
  confirmedById: string | null;
  confirmedAt: string | null;
  updatedAt: string;
}

/** A year row with its days, as ONE statement read them (see `readYears`). */
interface StoredYear {
  id: string;
  year: number;
  weekendDays: number[];
  status: CalendarYearStatus;
  revision: number;
  confirmedById: string | null;
  confirmedAt: Date | null;
  note: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** By date; `date` is `YYYY-MM-DD`. */
  days: Array<{ date: string; kind: CalendarDayKind; label: string | null }>;
}

type Reader = PrismaService | Prisma.TransactionClient;

export const MAX_CALENDAR_LABEL_LENGTH = 200;

const dateOfIso = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/** What decides a deadline: the weekly days off and each exception with its kind. Labels and notes are not part of it. */
const fingerprint = (weekendDays: readonly number[], days: ReadonlyArray<{ date: string; kind: string }>): string =>
  JSON.stringify([[...weekendDays].sort((a, b) => a - b), days.map((day) => `${day.date}:${day.kind}`).sort()]);

const cleanText = (text: string | null | undefined): string | null => {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  return trimmed === '' ? null : trimmed;
};

/**
 * The years `fromYear`..`toYear` with their days, read by ONE SQL statement.
 *
 * One statement is one snapshot of the database, in a transaction of the caller as well as outside one: the status of
 * a year and its days always belong to the same committed state. Two statements (a year query, then a day query, which
 * is what a Prisma `include` sends) would let a save commit in between, and hand the deadline engine the NEW days
 * under the OLD `CONFIRMED` status.
 */
function readYears(client: Reader, fromYear: number, toYear: number): Promise<StoredYear[]> {
  return client.$queryRaw<StoredYear[]>`
    SELECT y."id",
           y."year",
           y."weekendDays",
           y."status"::text AS "status",
           y."revision",
           y."confirmedById",
           y."confirmedAt",
           y."note",
           y."updatedById",
           y."createdAt",
           y."updatedAt",
           COALESCE(
             (
               SELECT json_agg(
                        json_build_object('date', to_char(d."date", 'YYYY-MM-DD'), 'kind', d."kind"::text, 'label', d."label")
                        ORDER BY d."date"
                      )
               FROM "proc_working_calendar_days" d
               WHERE d."yearId" = y."id"
             ),
             '[]'::json
           ) AS "days"
    FROM "proc_working_calendar_years" y
    WHERE y."year" BETWEEN ${fromYear} AND ${toYear}
    ORDER BY y."year"
  `;
}

/**
 * The working calendar, year by year: reading it for the deadline engine, and the writes of an administrator.
 *
 * Every write takes the year row FOR UPDATE, checks the row and revision the writer looked at (`REVISION_CONFLICT`),
 * goes up one revision, and leaves an audit row in the same transaction (the year, its status, counts; never a label).
 * Refusals are `{ code }` objects; no display text travels.
 *
 * Who may write is the caller's business: `WorkingCalendarController` guards the routes.
 */
@Injectable()
export class WorkingCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The calendar of the years `fromYear`..`toYear` (both included), as the engine reads it. A year in the range that
   * has no row behaves as: weekends off, no holidays, not confirmed. `tx`: read inside the caller's transaction.
   * Years and days come from one snapshot (`readYears`).
   */
  async load(fromYear: number, toYear: number, tx: Reader = this.prisma): Promise<WorkingCalendar> {
    this.assertYear(fromYear);
    this.assertYear(toYear);
    if (fromYear > toYear) throw new BadRequestException({ code: PROCESSING_ERROR.CALENDAR_YEAR_INVALID });
    return buildWorkingCalendar((await readYears(tx, fromYear, toYear)).map(toYearData));
  }

  /** Every stored year, by year, with its state and its counts. A year that has no row is not listed. */
  async listYears(): Promise<CalendarYearSummaryDto[]> {
    return (await readYears(this.prisma, MIN_CALENDAR_YEAR, MAX_CALENDAR_YEAR)).map((row) => ({
      id: row.id,
      year: row.year,
      weekendDays: [...row.weekendDays],
      status: row.status,
      revision: row.revision,
      daysOff: row.days.filter((day) => day.kind === 'OFF').length,
      workingDays: row.days.filter((day) => day.kind === 'WORKING').length,
      note: row.note,
      confirmedById: row.confirmedById,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  /** The year as stored (its `id` and `revision` are what a later write must send back), or `null` when it has no row. */
  async getYear(year: number): Promise<CalendarYearDto | null> {
    this.assertYear(year);
    const [row] = await readYears(this.prisma, year, year);
    return row ? toDto(row) : null;
  }

  /**
   * Creates the year (`expected: null`) or replaces ALL its days (`expected`: the row and revision looked at), in one
   * transaction.
   *
   * A confirmed year whose weekly days off or exceptions (date and kind) change goes back to DRAFT: what was
   * confirmed is no longer what is stored. Changing only labels or the note leaves it confirmed.
   */
  async saveYear(year: number, input: CalendarYearSaveInput, actorId: string): Promise<CalendarYearDto> {
    this.assertYear(year);
    const weekendDays = [...(Array.isArray(input.weekendDays) ? input.weekendDays : [Number.NaN])];
    const days = (Array.isArray(input.days) ? input.days : []).map((day) => ({ date: day?.date, kind: day?.kind, label: cleanText(day?.label) }));
    this.checked(() => checkCalendarYear({ year, weekendDays, days }));
    if (days.some((day) => (day.label?.length ?? 0) > MAX_CALENDAR_LABEL_LENGTH)) {
      throw new BadRequestException({ code: PROCESSING_ERROR.CALENDAR_DAY_INVALID });
    }
    const note = cleanText(input.note);

    try {
      const saved = await this.prisma.$transaction(async (tx) => {
        const current = await this.locked(tx, year);
        if (!isWhatWasLookedAt(current, input.expected)) throw new ConflictException({ code: PROCESSING_ERROR.REVISION_CONFLICT });

        if (!current) {
          await tx.procWorkingCalendarYear.create({
            data: {
              year,
              weekendDays,
              note,
              updatedById: actorId,
              days: { create: days.map((day) => ({ date: dateOfIso(day.date), kind: day.kind, label: day.label })) },
            },
          });
          const created = await this.stored(tx, year);
          await this.log(tx, 'PROC_CALENDAR_YEAR_CREATE', actorId, created);
          return created;
        }

        const daysChanged = fingerprint(current.weekendDays, current.days) !== fingerprint(weekendDays, days);
        const backToDraft = daysChanged && current.status === 'CONFIRMED';
        await tx.procWorkingCalendarDay.deleteMany({ where: { yearId: current.id } });
        if (days.length > 0) {
          await tx.procWorkingCalendarDay.createMany({
            data: days.map((day) => ({ yearId: current.id, date: dateOfIso(day.date), kind: day.kind, label: day.label })),
          });
        }
        await tx.procWorkingCalendarYear.update({
          where: { id: current.id },
          data: {
            weekendDays,
            note,
            revision: { increment: 1 },
            updatedById: actorId,
            ...(backToDraft ? { status: 'DRAFT', confirmedById: null, confirmedAt: null } : {}),
          },
        });
        const updated = await this.stored(tx, year);
        await this.log(tx, 'PROC_CALENDAR_YEAR_UPDATE', actorId, updated, { daysChanged, backToDraft });
        return updated;
      });
      return toDto(saved);
    } catch (error) {
      // Two people created the same year at once: the second one looked at a year that no longer has no row.
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException({ code: PROCESSING_ERROR.REVISION_CONFLICT });
      throw error;
    }
  }

  /** A person declares the days of the year complete: deadlines that lean on it stop being provisional. */
  async confirmYear(year: number, expected: CalendarYearExpectation, actorId: string): Promise<CalendarYearDto> {
    this.assertYear(year);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockedExisting(tx, year, expected);
      if (current.status === 'CONFIRMED') throw new ConflictException({ code: PROCESSING_ERROR.CALENDAR_YEAR_ALREADY_CONFIRMED });
      await tx.procWorkingCalendarYear.update({
        where: { id: current.id },
        data: { status: 'CONFIRMED', confirmedById: actorId, confirmedAt: new Date(), revision: { increment: 1 }, updatedById: actorId },
      });
      const updated = await this.stored(tx, year);
      await this.log(tx, 'PROC_CALENDAR_YEAR_CONFIRM', actorId, updated);
      return updated;
    });
    return toDto(row);
  }

  /** The way back from `confirmYear`: the year is a draft again, its days untouched. */
  async unconfirmYear(year: number, expected: CalendarYearExpectation, actorId: string): Promise<CalendarYearDto> {
    this.assertYear(year);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockedExisting(tx, year, expected);
      if (current.status !== 'CONFIRMED') throw new ConflictException({ code: PROCESSING_ERROR.CALENDAR_YEAR_NOT_CONFIRMED });
      await tx.procWorkingCalendarYear.update({
        where: { id: current.id },
        data: { status: 'DRAFT', confirmedById: null, confirmedAt: null, revision: { increment: 1 }, updatedById: actorId },
      });
      const updated = await this.stored(tx, year);
      await this.log(tx, 'PROC_CALENDAR_YEAR_UNCONFIRM', actorId, updated);
      return updated;
    });
    return toDto(row);
  }

  /**
   * Removes the year and its days: it then behaves as a year with no row. Only a DRAFT year; a confirmed one must be
   * unconfirmed first (`CALENDAR_YEAR_CONFIRMED`), so that removing what deadlines were confirmed on takes two steps.
   * Entering the year again makes ANOTHER row: what was looked at before the deletion no longer opens it.
   */
  async deleteYear(year: number, expected: CalendarYearExpectation, actorId: string): Promise<{ deleted: true; year: number; id: string }> {
    this.assertYear(year);
    const id = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockedExisting(tx, year, expected);
      if (current.status === 'CONFIRMED') throw new ConflictException({ code: PROCESSING_ERROR.CALENDAR_YEAR_CONFIRMED });
      // The days first: the relation is RESTRICT, so the order is the whole of it.
      await tx.procWorkingCalendarDay.deleteMany({ where: { yearId: current.id } });
      await tx.procWorkingCalendarYear.delete({ where: { id: current.id } });
      await this.log(tx, 'PROC_CALENDAR_YEAR_DELETE', actorId, current);
      return current.id;
    });
    return { deleted: true, year, id };
  }

  // ---- shared

  private assertYear(year: number): void {
    if (!Number.isInteger(year) || year < MIN_CALENDAR_YEAR || year > MAX_CALENDAR_YEAR) {
      throw new BadRequestException({ code: PROCESSING_ERROR.CALENDAR_YEAR_INVALID });
    }
  }

  /** A refusal of the pure layer becomes a 400 carrying its code. */
  private checked(run: () => void): void {
    try {
      run();
    } catch (error) {
      if (error instanceof ProcessingEngineError) throw new BadRequestException({ code: error.code });
      throw error;
    }
  }

  /** The year as it is NOW, under a row lock held to the end of the transaction; `null` when it has no row. */
  private async locked(tx: Prisma.TransactionClient, year: number): Promise<StoredYear | null> {
    await tx.$queryRaw`SELECT id FROM proc_working_calendar_years WHERE year = ${year} FOR UPDATE`;
    return (await readYears(tx, year, year))[0] ?? null;
  }

  private async lockedExisting(tx: Prisma.TransactionClient, year: number, expected: CalendarYearExpectation): Promise<StoredYear> {
    const current = await this.locked(tx, year);
    if (!current) throw new NotFoundException({ code: PROCESSING_ERROR.CALENDAR_YEAR_NOT_FOUND });
    if (!isWhatWasLookedAt(current, expected)) throw new ConflictException({ code: PROCESSING_ERROR.REVISION_CONFLICT });
    return current;
  }

  /** The year this transaction has just written. */
  private async stored(tx: Prisma.TransactionClient, year: number): Promise<StoredYear> {
    const [row] = await readYears(tx, year, year);
    if (!row) throw new NotFoundException({ code: PROCESSING_ERROR.CALENDAR_YEAR_NOT_FOUND });
    return row;
  }

  private log(tx: Prisma.TransactionClient, action: string, actorId: string, row: StoredYear, extra: Record<string, unknown> = {}): Promise<void> {
    return this.audit.log(
      {
        userId: actorId,
        action,
        subject: 'ProcWorkingCalendarYear',
        subjectId: row.id,
        // Metadata only: which year, its state, how many exceptions of each kind.
        metadata: {
          year: row.year,
          status: row.status,
          revision: row.revision,
          weekendDays: row.weekendDays,
          daysOff: row.days.filter((day) => day.kind === 'OFF').length,
          workingDays: row.days.filter((day) => day.kind === 'WORKING').length,
          ...extra,
        },
      },
      tx,
    );
  }
}

/**
 * Whether the year as it is now is what the writer looked at: the same row AND the same revision. No row is matched
 * only by "no row" (`null`). The number alone is not enough: a year deleted and entered again is at revision 1 again.
 */
function isWhatWasLookedAt(current: CalendarYearExpectation | null, expected: CalendarYearExpectation | null | undefined): boolean {
  if (current === null) return expected === null;
  return expected !== null && expected !== undefined && current.id === expected.id && current.revision === expected.revision;
}

function toYearData(row: StoredYear): WorkingCalendarYearData {
  return { year: row.year, weekendDays: row.weekendDays, status: row.status, days: row.days };
}

function toDto(row: StoredYear): CalendarYearDto {
  return {
    id: row.id,
    year: row.year,
    weekendDays: [...row.weekendDays],
    status: row.status,
    revision: row.revision,
    confirmedById: row.confirmedById,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    note: row.note,
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    days: row.days.map((day) => ({ date: day.date, kind: day.kind, label: day.label })),
  };
}
