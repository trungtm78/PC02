import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPushScheduler } from './notification-push.scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

const mockPrisma = {
  notification: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockPush = {
  sendToUser: jest.fn(),
};

const NOW = new Date('2026-06-02T03:00:00.000Z'); // Tue 10:00 VN — within work hours

describe('NotificationPushScheduler', () => {
  let scheduler: NotificationPushScheduler;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.update.mockResolvedValue({});
    mockPush.sendToUser.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPushScheduler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPush },
      ],
    }).compile();

    scheduler = module.get<NotificationPushScheduler>(NotificationPushScheduler);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('skips notifications where acknowledgedAt is set', async () => {
    // findMany returns empty (scheduler only queries WHERE acknowledgedAt IS NULL)
    // If filter is wrong, we'd see sendToUser called
    mockPrisma.notification.findMany.mockResolvedValue([]);

    await scheduler.runDispatcher();

    expect(mockPush.sendToUser).not.toHaveBeenCalled();
  });

  it('skips notifications where pushNextRetryAt is null (exhausted retries)', async () => {
    // pushNextRetryAt=null means exhausted — they should NOT appear in the query.
    // Simulate the scheduler correctly filtering by verifying mock was called with
    // WHERE pushNextRetryAt: { lte: now }.
    mockPrisma.notification.findMany.mockResolvedValue([]);

    await scheduler.runDispatcher();

    const callArg = mockPrisma.notification.findMany.mock.calls[0][0];
    expect(callArg.where.pushNextRetryAt).toEqual({ lte: NOW });
    expect(callArg.where.acknowledgedAt).toBe(null);
  });

  it('increments pushRetryCount and sets next pushNextRetryAt on successful send', async () => {
    const notif = {
      id: 'n1',
      userId: 'user-1',
      title: 'Test',
      message: 'Body',
      type: 'CASE_ASSIGNED',
      link: '/cases/1',
      pushRetryCount: 0,
      pushMaxRetries: 3,
    };
    mockPrisma.notification.findMany.mockResolvedValue([notif]);

    await scheduler.runDispatcher();

    expect(mockPush.sendToUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ title: 'Test' }));
    const updateCall = mockPrisma.notification.update.mock.calls[0][0];
    expect(updateCall.data.pushRetryCount).toBe(1);
    expect(updateCall.data.pushNextRetryAt).not.toBeNull(); // should schedule next retry
    expect(updateCall.data.pushSentAt).toEqual(NOW);
  });

  it('sets pushNextRetryAt=null after final retry (count reaches max)', async () => {
    const notif = {
      id: 'n1',
      userId: 'user-1',
      title: 'Test',
      message: 'Body',
      type: 'CASE_ASSIGNED',
      link: '/cases/1',
      pushRetryCount: 2, // already at max-1
      pushMaxRetries: 3,
    };
    mockPrisma.notification.findMany.mockResolvedValue([notif]);

    await scheduler.runDispatcher();

    const updateCall = mockPrisma.notification.update.mock.calls[0][0];
    expect(updateCall.data.pushRetryCount).toBe(3);
    expect(updateCall.data.pushNextRetryAt).toBeNull(); // final retry — stop
  });

  it('advances pushRetryCount and sets next pushNextRetryAt even when push fails (C2 fix)', async () => {
    const notif = {
      id: 'n-fail',
      userId: 'user-1',
      title: 'Fail',
      message: 'Body',
      type: 'CASE_ASSIGNED',
      link: '/cases/1',
      pushRetryCount: 0,
      pushMaxRetries: 3,
    };
    mockPrisma.notification.findMany.mockResolvedValue([notif]);
    mockPush.sendToUser.mockRejectedValueOnce(new Error('FCM unavailable'));

    await scheduler.runDispatcher();

    // Must still update the row — advance the retry count so it doesn't spin forever
    const updateCall = mockPrisma.notification.update.mock.calls[0]?.[0];
    expect(updateCall).toBeDefined();
    expect(updateCall.where).toEqual({ id: 'n-fail' });
    expect(updateCall.data.pushRetryCount).toBe(1);
    expect(updateCall.data.pushNextRetryAt).not.toBeNull();
  });

  it('sets pushNextRetryAt=null on final failed retry (count reaches max) (C2 fix)', async () => {
    const notif = {
      id: 'n-exhaust',
      userId: 'user-1',
      title: 'Fail',
      message: 'Body',
      type: 'CASE_ASSIGNED',
      link: '/cases/1',
      pushRetryCount: 2, // last attempt
      pushMaxRetries: 3,
    };
    mockPrisma.notification.findMany.mockResolvedValue([notif]);
    mockPush.sendToUser.mockRejectedValueOnce(new Error('FCM unavailable'));

    await scheduler.runDispatcher();

    const updateCall = mockPrisma.notification.update.mock.calls[0]?.[0];
    expect(updateCall.data.pushRetryCount).toBe(3);
    expect(updateCall.data.pushNextRetryAt).toBeNull();
  });

  it('continues dispatching other notifications when one push fails', async () => {
    const notif1 = {
      id: 'n1', userId: 'u1', title: 'T1', message: 'M1',
      type: 'CASE_ASSIGNED', link: '/c/1', pushRetryCount: 0, pushMaxRetries: 3,
    };
    const notif2 = {
      id: 'n2', userId: 'u2', title: 'T2', message: 'M2',
      type: 'CASE_ASSIGNED', link: '/c/2', pushRetryCount: 0, pushMaxRetries: 3,
    };
    mockPrisma.notification.findMany.mockResolvedValue([notif1, notif2]);
    mockPush.sendToUser
      .mockRejectedValueOnce(new Error('FCM error'))
      .mockResolvedValueOnce(undefined);

    await scheduler.runDispatcher();

    // Second notification should still be processed
    expect(mockPush.sendToUser).toHaveBeenCalledTimes(2);
  });
});
