/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * NotificationsService Unit Tests
 *
 * getList:
 *   - returns { success, data, total, unreadCount, limit, offset }
 *   - filters by unreadOnly flag
 *
 * markAsRead:
 *   - returns success: false when notification not found
 *   - skips update when already read, returns existing record
 *   - updates isRead=true and calls prisma.notification.update
 *
 * markAllAsRead:
 *   - calls updateMany and returns updatedCount
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  notification: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn(),
    createMany: jest.fn(),
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'SYSTEM',
    title: 'Test notification',
    message: 'Test message',
    isRead: false,
    readAt: null,
    link: null,
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    mockPrisma.notification.update.mockResolvedValue(makeNotification({ isRead: true }));
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.notification.delete.mockResolvedValue({});
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 0 });
  });

  // ── getList ────────────────────────────────────────────────────────────────

  describe('getList', () => {
    it('returns required response shape', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([makeNotification()]);
      mockPrisma.notification.count
        .mockResolvedValueOnce(1)  // total
        .mockResolvedValueOnce(1); // unreadCount

      const result = await service.getList('user-1', { limit: 20, offset: 0 });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('unreadCount', 1);
      expect(result).toHaveProperty('limit', 20);
      expect(result).toHaveProperty('offset', 0);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('passes unreadOnly:true filter to Prisma when requested', async () => {
      await service.getList('user-1', { unreadOnly: true, limit: 20, offset: 0 });

      const callArgs = mockPrisma.notification.findMany.mock.calls[0][0];
      expect(callArgs.where).toMatchObject({ userId: 'user-1', isRead: false });
    });

    it('does not add isRead filter when unreadOnly is false', async () => {
      await service.getList('user-1', { unreadOnly: false, limit: 20, offset: 0 });

      const callArgs = mockPrisma.notification.findMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty('isRead');
    });
  });

  // ── markAsRead ─────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('returns success: false when notification not found', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      const result = await service.markAsRead('notif-missing', 'user-1');

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('message', 'Notification not found');
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('returns existing record without update when already read', async () => {
      const alreadyRead = makeNotification({ isRead: true, readAt: new Date() });
      mockPrisma.notification.findFirst.mockResolvedValue(alreadyRead);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.data).toBe(alreadyRead);
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('calls prisma.update with isRead=true when notification is unread', async () => {
      const unread = makeNotification({ isRead: false });
      mockPrisma.notification.findFirst.mockResolvedValue(unread);
      const updated = makeNotification({ isRead: true });
      mockPrisma.notification.update.mockResolvedValue(updated);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-1' },
          data: expect.objectContaining({ isRead: true }),
        }),
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe(updated);
    });
  });

  // ── markAllAsRead ──────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('calls updateMany for the given user and returns updatedCount', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead('user-1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', isRead: false },
          data: expect.objectContaining({ isRead: true }),
        }),
      );
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('updatedCount', 3);
    });

    it('returns updatedCount: 0 when no unread notifications exist', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead('user-1');

      expect(result.updatedCount).toBe(0);
    });
  });
});
