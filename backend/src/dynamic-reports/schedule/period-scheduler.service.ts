import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CalendarEventsService } from '../../calendar-events/calendar-events.service';
import { computePeriodsToEnsure } from './catch-up';
import type { ScheduleRule } from '../engine/period';

/**
 * PeriodScheduler (spec §6.1 PR5, R17). Cron tick generates every missing
 * period — current + a lookahead window, plus catch-up for anything missed
 * during downtime (catch-up.ts) — and eagerly creates the assignment +
 * submission rows for each (spec §10 R5: submissions are created alongside
 * the assignment, never lazily, so every write path can `SELECT ... FOR
 * UPDATE` a row that already exists).
 *
 * R17: `pg_try_advisory_xact_lock` (non-blocking — a tick that finds the
 * previous one still running just skips instead of queuing) wraps the
 * whole run so two overlapping ticks (a slow run + the next cron fire)
 * can never generate the same period twice via a race outside the DB's
 * own unique constraints.
 *
 * R12 lock order (period → assignment → submission) is naturally satisfied
 * here because each is created in that sequence within the same
 * transaction — nothing downstream ever creates a period after its
 * assignments.
 */

const LOOKAHEAD_PERIODS = 6; // spec: "Preview tối thiểu 6 kỳ"
const SCHEDULER_LOCK_KEY = 'dynamic-reports-period-scheduler';

interface LockRow {
  locked: boolean;
}

@Injectable()
export class PeriodSchedulerService {
  private readonly logger = new Logger(PeriodSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarEvents: CalendarEventsService,
  ) {}

  @Cron('0 * * * *', { name: SCHEDULER_LOCK_KEY })
  async run(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [lockRow] = await tx.$queryRaw<LockRow[]>`
        SELECT pg_try_advisory_xact_lock(hashtext(${SCHEDULER_LOCK_KEY})) AS locked
      `;
      if (!lockRow?.locked) {
        this.logger.log('Previous tick still running — skipping this one.');
        return;
      }
      await this.generateForAllReports(tx, new Date());
    });
  }

  async generateForAllReports(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    now: Date,
  ): Promise<void> {
    const reports = await tx.dynReport.findMany({
      where: { status: 'PUBLISHED' },
      include: { schedules: { where: { supersededAt: null } } },
    });

    for (const report of reports) {
      for (const schedule of report.schedules) {
        if (schedule.effectiveFrom > now) continue;
        try {
          await this.generateForSchedule(tx, report.id, schedule, now);
        } catch (err) {
          this.logger.error(
            `Period generation failed for report ${report.id}, schedule ${schedule.id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }
  }

  private toScheduleRule(schedule: {
    periodType: string;
    periodStartDay: number | null;
    dueRule: unknown;
    openRule: unknown;
    shiftNonWorking: boolean;
    oneTimeDate: string | null;
  }): ScheduleRule {
    return {
      periodType: schedule.periodType as ScheduleRule['periodType'],
      periodStartDay: schedule.periodStartDay ?? undefined,
      due: schedule.dueRule as ScheduleRule['due'],
      open: schedule.openRule as ScheduleRule['open'],
      shiftNonWorking: schedule.shiftNonWorking,
      oneTimeDate: schedule.oneTimeDate ?? undefined,
    };
  }

  private async resolveNonWorkingDates(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    from: Date,
    to: Date,
  ): Promise<Set<string>> {
    const events = await tx.calendarEvent.findMany({
      where: { scope: 'SYSTEM', isOfficialDayOff: true },
      include: { overrides: true },
    });
    const occurrences = this.calendarEvents.expandOccurrences(events, from, to);
    return new Set(
      occurrences.map((o) => o.occurrenceDate.toISOString().slice(0, 10)),
    );
  }

  private async generateForSchedule(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    reportId: string,
    schedule: {
      id: string;
      periodType: string;
      periodStartDay: number | null;
      dueRule: unknown;
      openRule: unknown;
      shiftNonWorking: boolean;
      oneTimeDate: string | null;
      lastGeneratedThrough: Date | null;
      effectiveFrom: Date;
    },
    now: Date,
  ): Promise<void> {
    const version = await tx.dynReportVersion.findFirst({
      where: { reportId, status: 'PUBLISHED' },
      orderBy: { version: 'desc' },
    });
    if (!version) {
      this.logger.warn(
        `Report ${reportId} has an active schedule but no PUBLISHED version — skipping.`,
      );
      return;
    }

    const rule = this.toScheduleRule(schedule);
    const cursorStart = schedule.lastGeneratedThrough ?? schedule.effectiveFrom;
    const nonWorkingDates = schedule.shiftNonWorking
      ? await this.resolveNonWorkingDates(tx, cursorStart, now)
      : new Set<string>();
    const { periods, nextCursor } = computePeriodsToEnsure(
      rule,
      cursorStart,
      now,
      LOOKAHEAD_PERIODS,
      1_000,
      nonWorkingDates,
    );

    const targets = await tx.dynReportTarget.findMany({
      where: {
        reportId,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      include: { editors: true, team: true },
    });

    for (const period of periods) {
      const existing = await tx.dynReportPeriod.findUnique({
        where: {
          reportId_periodKey: { reportId, periodKey: period.periodKey },
        },
      });
      if (existing) continue;

      const createdPeriod = await tx.dynReportPeriod.create({
        data: {
          reportId,
          periodKey: period.periodKey,
          startDate: new Date(`${period.periodStart}T00:00:00Z`),
          endDate: new Date(`${period.periodEnd}T00:00:00Z`),
          opensAt: new Date(period.opensAt),
          dueAt: new Date(period.dueAt),
          versionId: version.id,
          scheduleSnapshot: {
            periodType: schedule.periodType,
            dueRule: schedule.dueRule,
            openRule: schedule.openRule,
            shiftNonWorking: schedule.shiftNonWorking,
          } as Prisma.InputJsonValue,
          status: 'OPEN',
        },
      });

      for (const target of targets) {
        const activeEditors = target.editors.filter(
          (e) => e.validFrom <= now && (!e.validTo || e.validTo > now),
        );
        const assignment = await tx.dynReportAssignment.create({
          data: {
            periodId: createdPeriod.id,
            teamId: target.teamId,
            teamSnapshot: {
              id: target.team.id,
              name: target.team.name,
              code: target.team.code,
            },
            obligation: 'REQUIRED',
          },
        });
        for (const editor of activeEditors) {
          await tx.dynReportAssignmentEditor.create({
            data: {
              assignmentId: assignment.id,
              userId: editor.userId,
              isActive: true,
            },
          });
        }
        await tx.dynReportSubmission.create({
          data: { assignmentId: assignment.id, state: 'NOT_STARTED' },
        });
      }
    }

    await tx.dynReportSchedule.update({
      where: { id: schedule.id },
      data: { lastGeneratedThrough: nextCursor },
    });
  }
}
