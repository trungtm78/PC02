import { Test, TestingModule } from '@nestjs/testing';
import { NotificationEventService } from './notification-event.service';
import { NotificationSseService } from './notification-sse.service';
import { RecipientResolverService } from './recipient-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaseAssignedEvent } from './events/notification.events';

const mockPrisma = {
  notification: {
    create: jest.fn(),
  },
  notificationPreference: {
    findUnique: jest.fn(),
  },
};

const mockSse = {
  notifyUser: jest.fn(),
};

const mockRecipients = {
  getAllHeadUnits: jest.fn(),
};

describe('NotificationEventService', () => {
  let service: NotificationEventService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null); // default prefs

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationSseService, useValue: mockSse },
        { provide: RecipientResolverService, useValue: mockRecipients },
      ],
    }).compile();

    service = module.get<NotificationEventService>(NotificationEventService);
  });

  describe('onCaseAssigned', () => {
    it('creates no notification and no SSE ping when inApp preference is false', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        inApp: false,
        push: true,
        email: false,
      });

      await service.onCaseAssigned(
        new CaseAssignedEvent('case-1', 'VV001', 'user-b', 'user-a', 'Admin'),
      );

      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
      expect(mockSse.notifyUser).not.toHaveBeenCalled();
    });

    it('creates notification with pushNextRetryAt=null when push preference is false', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        inApp: true,
        push: false,
        email: false,
      });

      await service.onCaseAssigned(
        new CaseAssignedEvent('case-1', 'VV001', 'user-b', 'user-a', 'Admin'),
      );

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pushNextRetryAt: null }),
        }),
      );
    });

    it('creates notification with pushNextRetryAt set when push=true (default prefs)', async () => {
      // default pref: null → { inApp: true, push: true }
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);

      const before = new Date();
      await service.onCaseAssigned(
        new CaseAssignedEvent('case-1', 'VV001', 'user-b', 'user-a', 'Admin'),
      );

      const call = mockPrisma.notification.create.mock.calls[0][0];
      expect(call.data.pushNextRetryAt).not.toBeNull();
      // pushNextRetryAt should be in the future (at least the next work-hours slot)
      expect(call.data.pushNextRetryAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('catches exceptions and logs error without rethrowing', async () => {
      mockPrisma.notificationPreference.findUnique.mockRejectedValue(new Error('DB down'));

      // Should not throw
      await expect(
        service.onCaseAssigned(
          new CaseAssignedEvent('case-1', 'VV001', 'user-b', 'user-a', 'Admin'),
        ),
      ).resolves.toBeUndefined();
    });

    it('pings SSE for the assigned user after creating the notification', async () => {
      await service.onCaseAssigned(
        new CaseAssignedEvent('case-1', 'VV001', 'user-b', 'user-a', 'Admin'),
      );

      expect(mockSse.notifyUser).toHaveBeenCalledWith('user-b');
    });
  });
});
