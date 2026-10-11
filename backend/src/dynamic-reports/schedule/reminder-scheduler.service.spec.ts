import { ReminderSchedulerService } from './reminder-scheduler.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * ReminderScheduler (spec §6.1 PR9, R17). Same mocked-`$transaction`
 * pattern as `period-scheduler.service.spec.ts` — the DB-integration
 * edges (real advisory lock, real unique constraint) are covered by the
 * `/run` real-environment walkthrough.
 */
describe('ReminderSchedulerService', () => {
  const DUE_AT = new Date('2026-06-20T17:00:00Z');

  function buildTx() {
    return {
      $queryRaw: jest.fn(),
      dynReportPeriod: { findMany: jest.fn() },
      dynReportReminder: { findUnique: jest.fn(), create: jest.fn() },
    };
  }

  function buildService(tx: ReturnType<typeof buildTx>, locked = true) {
    tx.$queryRaw.mockResolvedValue([{ locked }]);
    const prisma = {
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };
    const eventEmitter = { emit: jest.fn() };
    const service = new ReminderSchedulerService(
      prisma as unknown as PrismaService,
      eventEmitter as unknown as EventEmitter2,
    );
    return { service, eventEmitter };
  }

  function assignment(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'assign1',
      obligation: 'REQUIRED',
      submission: { state: 'NOT_STARTED' },
      editors: [{ userId: 'editor1' }],
      ...overrides,
    };
  }

  function period(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'period1',
      periodKey: '2026-06',
      dueAt: DUE_AT,
      status: 'OPEN',
      report: { name: 'HSLN' },
      assignments: [assignment()],
      ...overrides,
    };
  }

  it('does no work when the advisory lock is already held by another tick', async () => {
    const tx = buildTx();
    const { service, eventEmitter } = buildService(tx, false);

    await service.run();

    expect(tx.dynReportPeriod.findMany).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('sends a T3D reminder exactly at the 3-day window and records it', async () => {
    const tx = buildTx();
    tx.dynReportPeriod.findMany.mockResolvedValue([period()]);
    tx.dynReportReminder.findUnique.mockResolvedValue(null);
    const { service } = buildService(tx, true);
    const now = new Date(DUE_AT.getTime() - 3 * 24 * 60 * 60 * 1000);

    const events = await service.sendDueReminders(tx as never, now);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      assignmentId: 'assign1',
      reportName: 'HSLN',
      periodKey: '2026-06',
      toUserIds: ['editor1'],
      windowLabel: 'còn 3 ngày',
    });
    expect(tx.dynReportReminder.create).toHaveBeenCalledWith({
      data: { assignmentId: 'assign1', window: 'T3D' },
    });
  });

  it('does not re-send a window already recorded (dedup via findUnique)', async () => {
    const tx = buildTx();
    tx.dynReportPeriod.findMany.mockResolvedValue([period()]);
    tx.dynReportReminder.findUnique.mockResolvedValue({ id: 'already-sent' });
    const now = new Date(DUE_AT.getTime() - 3 * 24 * 60 * 60 * 1000);

    const service = new ReminderSchedulerService(
      { $transaction: jest.fn() } as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
    const events = await service.sendDueReminders(tx as never, now);

    expect(events).toHaveLength(0);
    expect(tx.dynReportReminder.create).not.toHaveBeenCalled();
  });

  it('skips a team not yet within any reminder window', async () => {
    const tx = buildTx();
    tx.dynReportPeriod.findMany.mockResolvedValue([period()]);
    const now = new Date(DUE_AT.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days out — before T3D

    const service = new ReminderSchedulerService(
      { $transaction: jest.fn() } as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
    const events = await service.sendDueReminders(tx as never, now);

    expect(events).toHaveLength(0);
    expect(tx.dynReportReminder.create).not.toHaveBeenCalled();
  });

  it('skips an assignment that is EXEMPT', async () => {
    const tx = buildTx();
    tx.dynReportPeriod.findMany.mockResolvedValue([
      period({ assignments: [assignment({ obligation: 'EXEMPT' })] }),
    ]);
    tx.dynReportReminder.findUnique.mockResolvedValue(null);
    const now = DUE_AT;

    const service = new ReminderSchedulerService(
      { $transaction: jest.fn() } as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
    const events = await service.sendDueReminders(tx as never, now);

    expect(events).toHaveLength(0);
  });

  it('skips an assignment already SUBMITTED/APPROVED', async () => {
    const tx = buildTx();
    tx.dynReportPeriod.findMany.mockResolvedValue([
      period({
        assignments: [assignment({ submission: { state: 'SUBMITTED' } })],
      }),
    ]);
    tx.dynReportReminder.findUnique.mockResolvedValue(null);
    const now = DUE_AT;

    const service = new ReminderSchedulerService(
      { $transaction: jest.fn() } as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
    const events = await service.sendDueReminders(tx as never, now);

    expect(events).toHaveLength(0);
  });

  it('skips an assignment with no active editor — nobody to notify', async () => {
    const tx = buildTx();
    tx.dynReportPeriod.findMany.mockResolvedValue([
      period({ assignments: [assignment({ editors: [] })] }),
    ]);
    tx.dynReportReminder.findUnique.mockResolvedValue(null);
    const now = DUE_AT;

    const service = new ReminderSchedulerService(
      { $transaction: jest.fn() } as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
    const events = await service.sendDueReminders(tx as never, now);

    expect(events).toHaveLength(0);
    expect(tx.dynReportReminder.create).not.toHaveBeenCalled();
  });

  it('ignores a FINALIZED/non-OPEN period entirely (query already filters status: OPEN)', async () => {
    const tx = buildTx();
    tx.dynReportPeriod.findMany.mockResolvedValue([]);
    const now = DUE_AT;

    const service = new ReminderSchedulerService(
      { $transaction: jest.fn() } as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
    const events = await service.sendDueReminders(tx as never, now);

    expect(tx.dynReportPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'OPEN' } }),
    );
    expect(events).toHaveLength(0);
  });

  it('can send multiple windows for the same assignment across separate ticks', async () => {
    const tx = buildTx();
    tx.dynReportPeriod.findMany.mockResolvedValue([period()]);
    // T3D already sent, T24H not yet.
    tx.dynReportReminder.findUnique.mockImplementation(
      ({ where }: { where: { assignmentId_window: { window: string } } }) =>
        Promise.resolve(
          where.assignmentId_window.window === 'T3D' ? { id: 'sent' } : null,
        ),
    );
    const now = new Date(DUE_AT.getTime() - 24 * 60 * 60 * 1000); // within T3D and T24H windows

    const service = new ReminderSchedulerService(
      { $transaction: jest.fn() } as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
    const events = await service.sendDueReminders(tx as never, now);

    expect(events).toHaveLength(1);
    expect(events[0].windowLabel).toBe('còn 24 giờ');
  });

  it('run() emits an event per reminder found, after the transaction commits', async () => {
    const tx = buildTx();
    // dueAt just 1s in the future relative to the REAL wall clock — every
    // window's start is already in the past, so this always fires
    // regardless of when the test actually runs (no Date mocking needed).
    tx.dynReportPeriod.findMany.mockResolvedValue([
      period({ dueAt: new Date(Date.now() + 1000) }),
    ]);
    tx.dynReportReminder.findUnique.mockResolvedValue(null);
    const { service, eventEmitter } = buildService(tx, true);

    await service.run();

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dyn-report.deadline-reminder',
      expect.objectContaining({ assignmentId: 'assign1' }),
    );
  });
});
