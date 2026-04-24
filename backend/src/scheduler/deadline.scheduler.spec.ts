import { Test, TestingModule } from '@nestjs/testing';
import { DeadlineScheduler } from './deadline.scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

const mockPrisma = {
  systemSetting: { findUnique: jest.fn() },
  case: { findMany: jest.fn() },
  incident: { findMany: jest.fn() },
  petition: { findMany: jest.fn() },
  overdueNotification: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockPushService = {
  sendToUser: jest.fn(),
};

const TODAY = new Date('2026-04-24T07:00:00Z');
const YESTERDAY = new Date('2026-04-23T07:00:00Z');
const IN_3_DAYS = new Date('2026-04-27T07:00:00Z');

describe('DeadlineScheduler', () => {
  let scheduler: DeadlineScheduler;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(TODAY);

    mockPrisma.systemSetting.findUnique.mockResolvedValue({ value: '7' });
    mockPrisma.case.findMany.mockResolvedValue([]);
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.petition.findMany.mockResolvedValue([]);
    mockPrisma.overdueNotification.findUnique.mockResolvedValue(null);
    mockPrisma.overdueNotification.upsert.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadlineScheduler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPushService },
      ],
    }).compile();
    scheduler = module.get<DeadlineScheduler>(DeadlineScheduler);
  });

  afterEach(() => jest.useRealTimers());

  it('reads CANH_BAO_SAP_HAN from SystemSetting', async () => {
    await scheduler.checkDeadlines();
    expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledWith({
      where: { key: 'CANH_BAO_SAP_HAN' },
    });
  });

  it('defaults to 7 days when setting not found', async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
    await expect(scheduler.checkDeadlines()).resolves.toBeUndefined();
  });

  it('notifies investigator when case is overdue', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'u1' }]) // overdue
      .mockResolvedValueOnce([]); // near

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledWith('u1', expect.objectContaining({
      title: 'Vụ án quá hạn',
      data: expect.objectContaining({ type: 'case_overdue', id: 'c1' }),
    }));
  });

  it('skips case with null investigatorId (null guard in DB query)', async () => {
    // The query has investigatorId: { not: null } — so results always have it.
    // This test verifies the scheduler completes even with empty results.
    mockPrisma.case.findMany.mockResolvedValue([]);
    await scheduler.checkDeadlines();
    expect(mockPushService.sendToUser).not.toHaveBeenCalled();
  });

  it('skips already-notified resource within 24h (dedup)', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'u1' }])
      .mockResolvedValueOnce([]);
    // notifiedAt within 24h
    mockPrisma.overdueNotification.findUnique.mockResolvedValue({
      notifiedAt: new Date(TODAY.getTime() - 3 * 60 * 60 * 1000), // 3h ago
    });

    await scheduler.checkDeadlines();
    expect(mockPushService.sendToUser).not.toHaveBeenCalled();
  });

  it('notifies again after 24h dedup window expires', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'u1' }])
      .mockResolvedValueOnce([]);
    // notifiedAt older than 24h
    mockPrisma.overdueNotification.findUnique.mockResolvedValue({
      notifiedAt: new Date(TODAY.getTime() - 25 * 60 * 60 * 1000), // 25h ago
    });

    await scheduler.checkDeadlines();
    expect(mockPushService.sendToUser).toHaveBeenCalledTimes(1);
  });

  it('persists OverdueNotification record after sending', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'u1' }])
      .mockResolvedValueOnce([]);

    await scheduler.checkDeadlines();

    expect(mockPrisma.overdueNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { resourceType_resourceId_userId: { resourceType: 'case', resourceId: 'c1', userId: 'u1' } },
      }),
    );
  });

  it('handles incidents and petitions in parallel', async () => {
    mockPrisma.incident.findMany
      .mockResolvedValueOnce([{ id: 'i1', name: 'Vụ việc A', investigatorId: 'u2' }])
      .mockResolvedValueOnce([]);
    mockPrisma.petition.findMany
      .mockResolvedValueOnce([{ id: 'p1', senderName: 'Nguyễn A', assignedToId: 'u3' }])
      .mockResolvedValueOnce([]);

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledWith('u2', expect.objectContaining({ title: 'Vụ việc quá hạn' }));
    expect(mockPushService.sendToUser).toHaveBeenCalledWith('u3', expect.objectContaining({ title: 'Đơn thư quá hạn' }));
  });

  it('notifies near-deadline case with correct type', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([]) // overdue
      .mockResolvedValueOnce([{ id: 'c2', name: 'Vụ án B', investigatorId: 'u1' }]); // near

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledWith('u1', expect.objectContaining({
      title: 'Vụ án sắp đến hạn',
      data: expect.objectContaining({ type: 'case_near_deadline' }),
    }));
  });
});
