import { PeriodSchedulerService } from './period-scheduler.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CalendarEventsService } from '../../calendar-events/calendar-events.service';

/**
 * PeriodScheduler (spec §6.1 PR5, R17). The DB-integration edges (real
 * Postgres advisory locks, real unique-constraint races) are covered by
 * the `/run` real-environment walkthrough per spec §8 — this unit suite
 * verifies the service's own decision logic against a mocked Prisma using
 * this repo's established `$transaction.mockImplementation(async (fn) =>
 * fn(tx))` pattern (admin/case-authority.spec.ts).
 */
describe('PeriodSchedulerService', () => {
  function buildTx() {
    return {
      $queryRaw: jest.fn(),
      dynReport: { findMany: jest.fn() },
      dynReportVersion: { findFirst: jest.fn() },
      dynReportTarget: { findMany: jest.fn() },
      dynReportPeriod: { findUnique: jest.fn(), create: jest.fn() },
      dynReportAssignment: { create: jest.fn() },
      dynReportAssignmentEditor: { create: jest.fn() },
      dynReportSubmission: { create: jest.fn() },
      dynReportSchedule: {
        update: jest.fn<
          unknown,
          [{ where: { id: string }; data: { lastGeneratedThrough: Date } }]
        >(),
      },
      calendarEvent: { findMany: jest.fn() },
    };
  }

  function buildService(tx: ReturnType<typeof buildTx>, locked = true) {
    tx.$queryRaw.mockResolvedValue([{ locked }]);
    const prisma = {
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };
    const calendarEvents = { expandOccurrences: jest.fn().mockReturnValue([]) };
    const service = new PeriodSchedulerService(
      prisma as unknown as PrismaService,
      calendarEvents as unknown as CalendarEventsService,
    );
    return { service, prisma, calendarEvents };
  }

  const now = new Date('2026-06-15T10:00:00Z');

  it('does no work when the advisory lock is already held by another tick', async () => {
    const tx = buildTx();
    const { service } = buildService(tx, false);

    await service.run();

    expect(tx.dynReport.findMany).not.toHaveBeenCalled();
  });

  it('does nothing when there are no PUBLISHED reports', async () => {
    const tx = buildTx();
    tx.dynReport.findMany.mockResolvedValue([]);
    const { service } = buildService(tx, true);

    await service.run();

    expect(tx.dynReportPeriod.create).not.toHaveBeenCalled();
  });

  it('skips a report whose schedule has no PUBLISHED version yet, without throwing', async () => {
    const tx = buildTx();
    tx.dynReport.findMany.mockResolvedValue([
      {
        id: 'rep1',
        schedules: [
          {
            id: 'sch1',
            periodType: 'MONTHLY',
            periodStartDay: null,
            dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
            openRule: { kind: 'AT_PERIOD_START' },
            shiftNonWorking: false,
            oneTimeDate: null,
            lastGeneratedThrough: now,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      },
    ]);
    tx.dynReportVersion.findFirst.mockResolvedValue(null);
    const { service } = buildService(tx, true);

    await expect(
      service.generateForAllReports(tx as never, now),
    ).resolves.toBeUndefined();
    expect(tx.dynReportPeriod.create).not.toHaveBeenCalled();
  });

  it('skips a schedule whose effectiveFrom is still in the future', async () => {
    const tx = buildTx();
    tx.dynReport.findMany.mockResolvedValue([
      {
        id: 'rep1',
        schedules: [
          {
            id: 'sch1',
            periodType: 'MONTHLY',
            effectiveFrom: new Date('2099-01-01T00:00:00Z'),
          },
        ],
      },
    ]);
    const { service } = buildService(tx, true);

    await service.generateForAllReports(tx as never, now);

    expect(tx.dynReportVersion.findFirst).not.toHaveBeenCalled();
  });

  it('creates period + assignment + editor + submission rows for each active target, then advances the schedule cursor', async () => {
    const tx = buildTx();
    tx.dynReport.findMany.mockResolvedValue([
      {
        id: 'rep1',
        schedules: [
          {
            id: 'sch1',
            periodType: 'MONTHLY',
            periodStartDay: null,
            dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
            openRule: { kind: 'AT_PERIOD_START' },
            shiftNonWorking: false,
            oneTimeDate: null,
            lastGeneratedThrough: now,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      },
    ]);
    tx.dynReportVersion.findFirst.mockResolvedValue({ id: 'ver1' });
    tx.dynReportTarget.findMany.mockResolvedValue([
      {
        teamId: 'team1',
        team: { id: 'team1', name: 'Đội 3', code: 'D3' },
        editors: [
          {
            userId: 'user1',
            validFrom: new Date('2026-01-01T00:00:00Z'),
            validTo: null,
          },
        ],
      },
    ]);
    tx.dynReportPeriod.findUnique.mockResolvedValue(null); // no existing periods
    tx.dynReportPeriod.create.mockImplementation(
      ({ data }: { data: { periodKey: string } }) =>
        Promise.resolve({ id: `period-${data.periodKey}`, ...data }),
    );
    tx.dynReportAssignment.create.mockResolvedValue({ id: 'assign1' });

    const { service } = buildService(tx, true);
    await service.generateForAllReports(tx as never, now);

    // 6 periods (LOOKAHEAD_PERIODS) × 1 target each.
    expect(tx.dynReportPeriod.create).toHaveBeenCalledTimes(6);
    expect(tx.dynReportAssignment.create).toHaveBeenCalledTimes(6);
    expect(tx.dynReportAssignmentEditor.create).toHaveBeenCalledTimes(6);
    expect(tx.dynReportAssignmentEditor.create).toHaveBeenCalledWith({
      data: { assignmentId: 'assign1', userId: 'user1', isActive: true },
    });
    expect(tx.dynReportSubmission.create).toHaveBeenCalledTimes(6);
    expect(tx.dynReportSubmission.create).toHaveBeenCalledWith({
      data: { assignmentId: 'assign1', state: 'NOT_STARTED' },
    });
    const scheduleUpdateArgs = tx.dynReportSchedule.update.mock.calls[0][0];
    expect(scheduleUpdateArgs.where).toEqual({ id: 'sch1' });
    expect(scheduleUpdateArgs.data.lastGeneratedThrough).toBeInstanceOf(Date);
  });

  it('skips creating a period that already exists (idempotent re-run), without touching assignments for it', async () => {
    const tx = buildTx();
    tx.dynReport.findMany.mockResolvedValue([
      {
        id: 'rep1',
        schedules: [
          {
            id: 'sch1',
            periodType: 'MONTHLY',
            periodStartDay: null,
            dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
            openRule: { kind: 'AT_PERIOD_START' },
            shiftNonWorking: false,
            oneTimeDate: null,
            lastGeneratedThrough: now,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      },
    ]);
    tx.dynReportVersion.findFirst.mockResolvedValue({ id: 'ver1' });
    tx.dynReportTarget.findMany.mockResolvedValue([]);
    tx.dynReportPeriod.findUnique.mockResolvedValue({ id: 'existing-period' }); // every period already exists

    const { service } = buildService(tx, true);
    await service.generateForAllReports(tx as never, now);

    expect(tx.dynReportPeriod.create).not.toHaveBeenCalled();
    expect(tx.dynReportSchedule.update).toHaveBeenCalled(); // cursor still advances
  });

  it('excludes an editor whose validTo has already passed from the assignment', async () => {
    const tx = buildTx();
    tx.dynReport.findMany.mockResolvedValue([
      {
        id: 'rep1',
        schedules: [
          {
            id: 'sch1',
            periodType: 'MONTHLY',
            periodStartDay: null,
            dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
            openRule: { kind: 'AT_PERIOD_START' },
            shiftNonWorking: false,
            oneTimeDate: null,
            lastGeneratedThrough: now,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      },
    ]);
    tx.dynReportVersion.findFirst.mockResolvedValue({ id: 'ver1' });
    tx.dynReportTarget.findMany.mockResolvedValue([
      {
        teamId: 'team1',
        team: { id: 'team1', name: 'Đội 3', code: 'D3' },
        editors: [
          {
            userId: 'expired-editor',
            validFrom: new Date('2026-01-01T00:00:00Z'),
            validTo: new Date('2026-02-01T00:00:00Z'), // expired before `now`
          },
        ],
      },
    ]);
    tx.dynReportPeriod.findUnique.mockResolvedValue(null);
    tx.dynReportPeriod.create.mockResolvedValue({ id: 'period1' });
    tx.dynReportAssignment.create.mockResolvedValue({ id: 'assign1' });

    const { service } = buildService(tx, true);
    await service.generateForAllReports(tx as never, now);

    expect(tx.dynReportAssignmentEditor.create).not.toHaveBeenCalled();
  });

  it('does not query calendar events when the schedule does not shift non-working days', async () => {
    const tx = buildTx();
    tx.dynReport.findMany.mockResolvedValue([
      {
        id: 'rep1',
        schedules: [
          {
            id: 'sch1',
            periodType: 'MONTHLY',
            periodStartDay: null,
            dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
            openRule: { kind: 'AT_PERIOD_START' },
            shiftNonWorking: false,
            oneTimeDate: null,
            lastGeneratedThrough: now,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      },
    ]);
    tx.dynReportVersion.findFirst.mockResolvedValue({ id: 'ver1' });
    tx.dynReportTarget.findMany.mockResolvedValue([]);
    tx.dynReportPeriod.findUnique.mockResolvedValue(null);
    tx.dynReportPeriod.create.mockResolvedValue({ id: 'period1' });

    const { service } = buildService(tx, true);
    await service.generateForAllReports(tx as never, now);

    expect(tx.calendarEvent.findMany).not.toHaveBeenCalled();
  });

  it('queries calendar events and expands occurrences when the schedule DOES shift non-working days', async () => {
    const tx = buildTx();
    tx.dynReport.findMany.mockResolvedValue([
      {
        id: 'rep1',
        schedules: [
          {
            id: 'sch1',
            periodType: 'MONTHLY',
            periodStartDay: null,
            dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
            openRule: { kind: 'AT_PERIOD_START' },
            shiftNonWorking: true,
            oneTimeDate: null,
            lastGeneratedThrough: now,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      },
    ]);
    tx.dynReportVersion.findFirst.mockResolvedValue({ id: 'ver1' });
    tx.dynReportTarget.findMany.mockResolvedValue([]);
    tx.dynReportPeriod.findUnique.mockResolvedValue(null);
    tx.dynReportPeriod.create.mockResolvedValue({ id: 'period1' });
    tx.calendarEvent.findMany.mockResolvedValue([]);

    const { service, calendarEvents } = buildService(tx, true);
    await service.generateForAllReports(tx as never, now);

    expect(tx.calendarEvent.findMany).toHaveBeenCalledWith({
      where: { scope: 'SYSTEM', isOfficialDayOff: true },
      include: { overrides: true },
    });
    expect(calendarEvents.expandOccurrences).toHaveBeenCalled();
  });

  it('a failure generating one report/schedule is logged and does not abort the other reports in the same tick', async () => {
    const tx = buildTx();
    tx.dynReport.findMany.mockResolvedValue([
      {
        id: 'rep-broken',
        schedules: [{ id: 'sch-broken', effectiveFrom: now }],
      },
      {
        id: 'rep-ok',
        schedules: [
          {
            id: 'sch-ok',
            periodType: 'MONTHLY',
            periodStartDay: null,
            dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
            openRule: { kind: 'AT_PERIOD_START' },
            shiftNonWorking: false,
            oneTimeDate: null,
            lastGeneratedThrough: now,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      },
    ]);
    // First findFirst call (for rep-broken) throws; second (rep-ok) succeeds.
    tx.dynReportVersion.findFirst
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ id: 'ver1' });
    tx.dynReportTarget.findMany.mockResolvedValue([]);
    tx.dynReportPeriod.findUnique.mockResolvedValue(null);
    tx.dynReportPeriod.create.mockResolvedValue({ id: 'period1' });

    const { service } = buildService(tx, true);
    await expect(
      service.generateForAllReports(tx as never, now),
    ).resolves.toBeUndefined();

    const scheduleUpdateArgs = tx.dynReportSchedule.update.mock.calls[0][0];
    expect(scheduleUpdateArgs.where).toEqual({ id: 'sch-ok' });
    expect(scheduleUpdateArgs.data.lastGeneratedThrough).toBeInstanceOf(Date);
  });
});
