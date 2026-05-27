import { Test } from '@nestjs/testing';
import { NotificationPreferencesService, ALL_PREF_TYPES } from './notification-preferences.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

const mockPrisma = {
  notificationPreference: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(NotificationPreferencesService);
    jest.clearAllMocks();
  });

  describe('getPreferences()', () => {
    it('returns defaults for all types when no DB records exist', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValue([]);
      const result = await service.getPreferences('user-1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(ALL_PREF_TYPES.length);
      result.data.forEach((pref: any) => {
        expect(pref.inApp).toBe(true);
        expect(pref.push).toBe(true);
      });
    });

    it('merges saved DB prefs over defaults', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValue([
        { eventType: NotificationType.CASE_ASSIGNED, inApp: true, push: false },
      ]);
      const result = await service.getPreferences('user-1');
      const casePref = result.data.find((p: any) => p.eventType === NotificationType.CASE_ASSIGNED);
      expect(casePref!.push).toBe(false);
      const otherPref = result.data.find((p: any) => p.eventType === NotificationType.INCIDENT_ASSIGNED);
      expect(otherPref!.push).toBe(true);
    });

    it('queries only for the current userId', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValue([]);
      await service.getPreferences('user-42');
      expect(mockPrisma.notificationPreference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-42' } }),
      );
    });
  });

  describe('upsertPreference()', () => {
    it('calls prisma upsert with correct args and returns success', async () => {
      mockPrisma.notificationPreference.upsert.mockResolvedValue({
        userId: 'user-1', eventType: NotificationType.CASE_ASSIGNED, inApp: true, push: false,
      });
      const result = await service.upsertPreference('user-1', NotificationType.CASE_ASSIGNED, { inApp: true, push: false });
      expect(result.success).toBe(true);
      expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_eventType: { userId: 'user-1', eventType: NotificationType.CASE_ASSIGNED } },
          create: expect.objectContaining({ userId: 'user-1', eventType: NotificationType.CASE_ASSIGNED, inApp: true, push: false }),
          update: expect.objectContaining({ inApp: true, push: false }),
        }),
      );
    });
  });

  describe('resetPreferences()', () => {
    it('deletes all prefs for userId and returns success', async () => {
      mockPrisma.notificationPreference.deleteMany.mockResolvedValue({ count: 5 });
      const result = await service.resetPreferences('user-1');
      expect(result.success).toBe(true);
      expect(mockPrisma.notificationPreference.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });
});
