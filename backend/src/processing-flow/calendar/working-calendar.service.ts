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

export interface CalendarYearSaveInput {
  /** JavaScript weekday numbers off every week: 0 = Sunday ... 6 = Saturday. */
  weekendDays: number[];
  /** ALL the exceptions of the year: what is not listed here is removed. */
  days: CalendarDayInput[];
  note?: string | null;
  /** The revision the writer looked at; `null` = "this year has no row yet". */
  expectedRevision: number | null;
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

const YEAR_WITH_DAYS = { days: { orderBy: { date: 'asc' } } } satisfies Prisma.ProcWorkingCalendarYearInclude;
type YearRow = Prisma.ProcWorkingCalendarYearGetPayload<{ include: typeof YEAR_WITH_DAYS }>;
type Reader = PrismaService | Prisma.TransactionClient;

export const MAX_CALENDAR_LABEL_LENGTH = 200;

/** A `@db.Date` column comes back at 00:00 UTC of the day that was stored. */
const isoDay = (date: Date): string => date.toISOString().slice(0, 10);
const dateOfIso = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/** What decides a deadline: the weekly days off and each exception with its kind. Labels and notes are not part of it. */
const fingerprint = (weekendDays: readonly number[], days: ReadonlyArray<{ date: string; kind: string }>): string =>
  JSON.stringify([[...weekendDays].sort((a, b) => a - b), days.map((day) => `${day.date}:${day.kind}`).sort()]);

const cleanText = (text: string | null | undefined): string | null => {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  return trimmed === '' ? null : trimmed;
};

/**
 * The working calendar, year by year: reading it for the deadline engine, and the writes of an administrator.
 *
 * Every write takes the year row FOR UPDATE, checks the revision the writer looked at (`REVISION_CONFLICT`), goes up
 * one revision, and leaves an audit row in the same transaction (the year, its status, counts; never a label).
 * Refusals are `{ code }` objects; no display text travels.
 *
 * Who may write is the caller's business: this PR has no route, the later controller guards them.
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
   */
  async load(fromYear: number, toYear: number, tx: Reader = this.prisma): Promise<WorkingCalendar> {
    this.assertYear(fromYear);
    this.assertYear(toYear);
    if (fromYear > toYear) throw new BadRequestException({ code: PROCESSING_ERROR.CALENDAR_YEAR_INVALID });
    const rows = await tx.procWorkingCalendarYear.findMany({
      where: { year: { gte: fromYear, lte: toYear } },
      include: YEAR_WITH_DAYS,
      orderBy: { year: 'asc' },
    });
    return buildWorkingCalendar(rows.map(toYearData));
  }

  /** The year as stored, or `null` when it has no row. */
  async getYear(year: number): Promise<CalendarYearDto | null> {
    this.assertYear(year);
    const row = await this.prisma.procWorkingCalendarYear.findUnique({ where: { year }, include: YEAR_WITH_DAYS });
    return row ? toDto(row) : null;
  }

  /**
   * Creates the year or replaces ALL its days, in one transaction.
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
        if ((current?.revision ?? null) !== input.expectedRevision) throw new ConflictException({ code: PROCESSING_ERROR.REVISION_CONFLICT });

        if (!current) {
          const created = await tx.procWorkingCalendarYear.create({
            data: {
              year,
              weekendDays,
              note,
              updatedById: actorId,
              days: { create: days.map((day) => ({ date: dateOfIso(day.date), kind: day.kind, label: day.label })) },
            },
            include: YEAR_WITH_DAYS,
          });
          await this.log(tx, 'PROC_CALENDAR_YEAR_CREATE', actorId, created);
          return created;
        }

        const before = fingerprint(current.weekendDays, current.days.map((day) => ({ date: isoDay(day.date), kind: day.kind })));
        const daysChanged = before !== fingerprint(weekendDays, days);
        const backToDraft = daysChanged && current.status === 'CONFIRMED';
        await tx.procWorkingCalendarDay.deleteMany({ where: { yearId: current.id } });
        if (days.length > 0) {
          await tx.procWorkingCalendarDay.createMany({
            data: days.map((day) => ({ yearId: current.id, date: dateOfIso(day.date), kind: day.kind, label: day.label })),
          });
        }
        const updated = await tx.procWorkingCalendarYear.update({
          where: { id: current.id },
          data: {
            weekendDays,
            note,
            revision: { increment: 1 },
            updatedById: actorId,
            ...(backToDraft ? { status: 'DRAFT', confirmedById: null, confirmedAt: null } : {}),
          },
          include: YEAR_WITH_DAYS,
        });
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
  async confirmYear(year: number, expectedRevision: number, actorId: string): Promise<CalendarYearDto> {
    this.assertYear(year);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockedExisting(tx, year, expectedRevision);
      if (current.status === 'CONFIRMED') throw new ConflictException({ code: PROCESSING_ERROR.CALENDAR_YEAR_ALREADY_CONFIRMED });
      const updated = await tx.procWorkingCalendarYear.update({
        where: { id: current.id },
        data: { status: 'CONFIRMED', confirmedById: actorId, confirmedAt: new Date(), revision: { increment: 1 }, updatedById: actorId },
        include: YEAR_WITH_DAYS,
      });
      await this.log(tx, 'PROC_CALENDAR_YEAR_CONFIRM', actorId, updated);
      return updated;
    });
    return toDto(row);
  }

  /** The way back from `confirmYear`: the year is a draft again, its days untouched. */
  async unconfirmYear(year: number, expectedRevision: number, actorId: string): Promise<CalendarYearDto> {
    this.assertYear(year);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockedExisting(tx, year, expectedRevision);
      if (current.status !== 'CONFIRMED') throw new ConflictException({ code: PROCESSING_ERROR.CALENDAR_YEAR_NOT_CONFIRMED });
      const updated = await tx.procWorkingCalendarYear.update({
        where: { id: current.id },
        data: { status: 'DRAFT', confirmedById: null, confirmedAt: null, revision: { increment: 1 }, updatedById: actorId },
        include: YEAR_WITH_DAYS,
      });
      await this.log(tx, 'PROC_CALENDAR_YEAR_UNCONFIRM', actorId, updated);
      return updated;
    });
    return toDto(row);
  }

  /**
   * Removes the year and its days: it then behaves as a year with no row. Only a DRAFT year; a confirmed one must be
   * unconfirmed first (`CALENDAR_YEAR_CONFIRMED`), so that removing what deadlines were confirmed on takes two steps.
   */
  async deleteYear(year: number, expectedRevision: number, actorId: string): Promise<{ deleted: true; year: number }> {
    this.assertYear(year);
    await this.prisma.$transaction(async (tx) => {
      const current = await this.lockedExisting(tx, year, expectedRevision);
      if (current.status === 'CONFIRMED') throw new ConflictException({ code: PROCESSING_ERROR.CALENDAR_YEAR_CONFIRMED });
      // The days first: the relation is RESTRICT, so the order is the whole of it.
      await tx.procWorkingCalendarDay.deleteMany({ where: { yearId: current.id } });
      await tx.procWorkingCalendarYear.delete({ where: { id: current.id } });
      await this.log(tx, 'PROC_CALENDAR_YEAR_DELETE', actorId, current);
    });
    return { deleted: true, year };
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
  private async locked(tx: Prisma.TransactionClient, year: number): Promise<YearRow | null> {
    await tx.$queryRaw`SELECT id FROM proc_working_calendar_years WHERE year = ${year} FOR UPDATE`;
    return tx.procWorkingCalendarYear.findUnique({ where: { year }, include: YEAR_WITH_DAYS });
  }

  private async lockedExisting(tx: Prisma.TransactionClient, year: number, expectedRevision: number): Promise<YearRow> {
    const current = await this.locked(tx, year);
    if (!current) throw new NotFoundException({ code: PROCESSING_ERROR.CALENDAR_YEAR_NOT_FOUND });
    if (current.revision !== expectedRevision) throw new ConflictException({ code: PROCESSING_ERROR.REVISION_CONFLICT });
    return current;
  }

  private log(tx: Prisma.TransactionClient, action: string, actorId: string, row: YearRow, extra: Record<string, unknown> = {}): Promise<void> {
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

function toYearData(row: YearRow): WorkingCalendarYearData {
  return {
    year: row.year,
    weekendDays: row.weekendDays,
    status: row.status,
    days: row.days.map((day) => ({ date: isoDay(day.date), kind: day.kind, label: day.label })),
  };
}

function toDto(row: YearRow): CalendarYearDto {
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
    days: row.days.map((day) => ({ date: isoDay(day.date), kind: day.kind, label: day.label })),
  };
}
