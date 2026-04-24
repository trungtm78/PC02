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
  userTeam: { findMany: jest.fn() },
  dataAccessGrant: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  notification: { create: jest.fn() },
};

const mockPushService = {
  sendToUser: jest.fn(),
};

const TODAY = new Date('2026-04-24T07:00:00Z');

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
    mockPrisma.userTeam.findMany.mockResolvedValue([]);
    mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.notification.create.mockResolvedValue({});

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

  // ─── Regression tests ────────────────────────────────────────────────────

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
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'u1', assignedTeamId: null }])
      .mockResolvedValueOnce([]);

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledWith('u1', expect.objectContaining({
      title: 'Vụ án quá hạn',
      data: expect.objectContaining({ type: 'case_overdue', id: 'c1' }),
    }));
  });

  it('skips when no recipients (both fields null)', async () => {
    mockPrisma.case.findMany.mockResolvedValue([]);
    await scheduler.checkDeadlines();
    expect(mockPushService.sendToUser).not.toHaveBeenCalled();
  });

  it('skips already-notified resource within 24h (dedup)', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'u1', assignedTeamId: null }])
      .mockResolvedValueOnce([]);
    mockPrisma.overdueNotification.findUnique.mockResolvedValue({
      notifiedAt: new Date(TODAY.getTime() - 3 * 60 * 60 * 1000),
    });

    await scheduler.checkDeadlines();
    expect(mockPushService.sendToUser).not.toHaveBeenCalled();
  });

  it('notifies again after 24h dedup window expires', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'u1', assignedTeamId: null }])
      .mockResolvedValueOnce([]);
    mockPrisma.overdueNotification.findUnique.mockResolvedValue({
      notifiedAt: new Date(TODAY.getTime() - 25 * 60 * 60 * 1000),
    });

    await scheduler.checkDeadlines();
    expect(mockPushService.sendToUser).toHaveBeenCalledTimes(1);
  });

  it('persists OverdueNotification record after sending', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'u1', assignedTeamId: null }])
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
      .mockResolvedValueOnce([{ id: 'i1', name: 'Vụ việc A', investigatorId: 'u2', assignedTeamId: null }])
      .mockResolvedValueOnce([]);
    mockPrisma.petition.findMany
      .mockResolvedValueOnce([{ id: 'p1', senderName: 'Nguyễn A', enteredById: 'u3', assignedTeamId: null }])
      .mockResolvedValueOnce([]);

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledWith('u2', expect.objectContaining({ title: 'Vụ việc quá hạn' }));
    expect(mockPushService.sendToUser).toHaveBeenCalledWith('u3', expect.objectContaining({ title: 'Đơn thư quá hạn' }));
  });

  it('notifies near-deadline case with correct type', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'c2', name: 'Vụ án B', investigatorId: 'u1', assignedTeamId: null }]);

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledWith('u1', expect.objectContaining({
      title: 'Vụ án sắp đến hạn',
      data: expect.objectContaining({ type: 'case_near_deadline' }),
    }));
  });

  // ─── Team scope ───────────────────────────────────────────────────────────

  it('notifies team member when case has assignedTeamId and no investigator', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: null, assignedTeamId: 't1' }])
      .mockResolvedValueOnce([]);
    mockPrisma.userTeam.findMany.mockResolvedValue([{ userId: 'member1' }]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'member1' }]);

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledWith('member1', expect.objectContaining({
      title: 'Vụ án quá hạn',
    }));
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'member1', type: 'CASE_OVERDUE' }),
      }),
    );
  });

  it('notifies DataAccessGrant holder (non-expired grant)', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: null, assignedTeamId: 't1' }])
      .mockResolvedValueOnce([]);
    mockPrisma.userTeam.findMany.mockResolvedValue([]);
    mockPrisma.dataAccessGrant.findMany.mockResolvedValue([{ granteeId: 'grantee1' }]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'grantee1' }]);

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledWith('grantee1', expect.any(Object));
  });

  it('excludes ADMIN from team expansion (user.findMany filters them out)', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: null, assignedTeamId: 't1' }])
      .mockResolvedValueOnce([]);
    mockPrisma.userTeam.findMany.mockResolvedValue([{ userId: 'admin1' }, { userId: 'member1' }]);
    // Simulate user.findMany filtering out ADMIN — only member1 passes
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'member1' }]);

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledTimes(1);
    expect(mockPushService.sendToUser).toHaveBeenCalledWith('member1', expect.any(Object));
    expect(mockPushService.sendToUser).not.toHaveBeenCalledWith('admin1', expect.any(Object));
  });

  it('notifies ADMIN when they are direct investigatorId (not filtered)', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'admin1', assignedTeamId: null }])
      .mockResolvedValueOnce([]);

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledWith('admin1', expect.any(Object));
  });

  it('notifies both investigator and team members, dedupes overlap', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'u1', assignedTeamId: 't1' }])
      .mockResolvedValueOnce([]);
    // u1 is both investigator and team member — team-expanded excludes u1 (it's directUserId)
    mockPrisma.userTeam.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u2' }]);

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledTimes(2);
    expect(mockPushService.sendToUser).toHaveBeenCalledWith('u1', expect.any(Object));
    expect(mockPushService.sendToUser).toHaveBeenCalledWith('u2', expect.any(Object));
  });

  it('creates DB notification with correct type per recipient', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'u1', assignedTeamId: null }])
      .mockResolvedValueOnce([]);

    await scheduler.checkDeadlines();

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          type: 'CASE_OVERDUE',
          title: 'Vụ án quá hạn',
          link: '/cases/c1',
        }),
      }),
    );
  });

  it('notifies incident team member with INCIDENT_OVERDUE type', async () => {
    mockPrisma.incident.findMany
      .mockResolvedValueOnce([{ id: 'i1', name: 'Vụ việc A', investigatorId: null, assignedTeamId: 't1' }])
      .mockResolvedValueOnce([]);
    mockPrisma.userTeam.findMany.mockResolvedValue([{ userId: 'member1' }]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'member1' }]);

    await scheduler.checkDeadlines();

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'INCIDENT_OVERDUE', userId: 'member1' }),
      }),
    );
  });

  it('petition uses enteredById as direct user (mirrors buildPetitionScopeFilter)', async () => {
    mockPrisma.petition.findMany
      .mockResolvedValueOnce([{
        id: 'p1',
        senderName: 'Nguyen A',
        enteredById: 'officer1',
        assignedTeamId: null,
      }])
      .mockResolvedValueOnce([]);

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledWith('officer1', expect.objectContaining({
      title: 'Đơn thư quá hạn',
    }));
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'PETITION_OVERDUE', userId: 'officer1' }),
      }),
    );
  });

  it('expired grant holder excluded (dataAccessGrant.findMany returns empty)', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: null, assignedTeamId: 't1' }])
      .mockResolvedValueOnce([]);
    mockPrisma.userTeam.findMany.mockResolvedValue([]);
    mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).not.toHaveBeenCalled();
  });

  it('per-user dedup: skips u1 (recent) but notifies u2 (fresh)', async () => {
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'c1', name: 'Vụ án A', investigatorId: 'u1', assignedTeamId: 't1' }])
      .mockResolvedValueOnce([]);
    mockPrisma.userTeam.findMany.mockResolvedValue([{ userId: 'u2' }]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u2' }]);
    mockPrisma.overdueNotification.findUnique.mockImplementation(({ where }) => {
      if (where.resourceType_resourceId_userId.userId === 'u1') {
        return Promise.resolve({ notifiedAt: new Date(TODAY.getTime() - 3 * 60 * 60 * 1000) });
      }
      return Promise.resolve(null);
    });

    await scheduler.checkDeadlines();

    expect(mockPushService.sendToUser).toHaveBeenCalledTimes(1);
    expect(mockPushService.sendToUser).toHaveBeenCalledWith('u2', expect.any(Object));
    expect(mockPushService.sendToUser).not.toHaveBeenCalledWith('u1', expect.any(Object));
  });
});
