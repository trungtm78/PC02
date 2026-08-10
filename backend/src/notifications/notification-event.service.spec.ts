import { Test, TestingModule } from '@nestjs/testing';
import { NotificationEventService } from './notification-event.service';
import { NotificationSseService } from './notification-sse.service';
import { RecipientResolverService } from './recipient-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CaseAssignedEvent,
  CaseCreatedEvent,
  IncidentAssignedEvent,
  PetitionAssignedEvent,
  UydtAssignedEvent,
} from './events/notification.events';

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
      expect(call.data.pushNextRetryAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it('catches exceptions and logs error without rethrowing', async () => {
      mockPrisma.notificationPreference.findUnique.mockRejectedValue(
        new Error('DB down'),
      );

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

  describe('onIncidentAssigned', () => {
    it('creates notification with correct type and link for incident', async () => {
      await service.onIncidentAssigned(
        new IncidentAssignedEvent(
          'inc-1',
          'Vụ cướp',
          'user-b',
          'user-a',
          'Admin',
        ),
      );

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-b',
            type: 'INCIDENT_ASSIGNED',
            link: '/incidents/inc-1',
          }),
        }),
      );
      expect(mockSse.notifyUser).toHaveBeenCalledWith('user-b');
    });

    it('does not create notification when inApp preference is false', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        inApp: false,
        push: true,
        email: false,
      });

      await service.onIncidentAssigned(
        new IncidentAssignedEvent(
          'inc-1',
          'Vụ cướp',
          'user-b',
          'user-a',
          'Admin',
        ),
      );

      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('catches exceptions without rethrowing', async () => {
      mockPrisma.notificationPreference.findUnique.mockRejectedValue(
        new Error('DB down'),
      );

      await expect(
        service.onIncidentAssigned(
          new IncidentAssignedEvent(
            'inc-1',
            'Vụ cướp',
            'user-b',
            'user-a',
            'Admin',
          ),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('onPetitionAssigned', () => {
    it('creates notification with correct type and link for petition', async () => {
      await service.onPetitionAssigned(
        new PetitionAssignedEvent(
          'pet-1',
          'Đơn tố cáo X',
          'user-b',
          'user-a',
          'Admin',
        ),
      );

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-b',
            type: 'PETITION_ASSIGNED',
            link: '/petitions/pet-1',
          }),
        }),
      );
      expect(mockSse.notifyUser).toHaveBeenCalledWith('user-b');
    });

    it('does not create notification when inApp preference is false', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        inApp: false,
        push: false,
        email: false,
      });

      await service.onPetitionAssigned(
        new PetitionAssignedEvent(
          'pet-1',
          'Đơn tố cáo X',
          'user-b',
          'user-a',
          'Admin',
        ),
      );

      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('onUydtAssigned', () => {
    it('fans out to both toUserId and toLeaderUserIds', async () => {
      await service.onUydtAssigned(
        new UydtAssignedEvent(
          'del-1',
          'UTDT-001',
          'assignee-1',
          ['leader-1', 'leader-2'],
          'user-a',
          'Admin',
        ),
      );

      // 3 targets: assignee-1, leader-1, leader-2
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(3);
      const userIds = mockPrisma.notification.create.mock.calls.map(
        (c: any) => c[0].data.userId,
      );
      expect(userIds).toEqual(
        expect.arrayContaining(['assignee-1', 'leader-1', 'leader-2']),
      );
    });

    it('sends only to toUserId when toLeaderUserIds is empty', async () => {
      await service.onUydtAssigned(
        new UydtAssignedEvent(
          'del-1',
          'UTDT-001',
          'assignee-1',
          [],
          'user-a',
          'Admin',
        ),
      );

      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'assignee-1',
            type: 'UTDT_ASSIGNED',
          }),
        }),
      );
    });

    it('catches exceptions without rethrowing', async () => {
      mockPrisma.notificationPreference.findUnique.mockRejectedValue(
        new Error('DB down'),
      );

      await expect(
        service.onUydtAssigned(
          new UydtAssignedEvent(
            'del-1',
            'UTDT-001',
            'assignee-1',
            [],
            'user-a',
            'Admin',
          ),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('onCaseCreated', () => {
    it('calls getAllHeadUnits and fans out to all leader IDs', async () => {
      mockRecipients.getAllHeadUnits.mockResolvedValue(['head-1', 'head-2']);

      await service.onCaseCreated(
        new CaseCreatedEvent('case-1', 'VV001', 'user-a'),
      );

      expect(mockRecipients.getAllHeadUnits).toHaveBeenCalledTimes(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
      const userIds = mockPrisma.notification.create.mock.calls.map(
        (c: any) => c[0].data.userId,
      );
      expect(userIds).toEqual(expect.arrayContaining(['head-1', 'head-2']));
    });

    it('creates no notifications when no head units exist', async () => {
      mockRecipients.getAllHeadUnits.mockResolvedValue([]);

      await service.onCaseCreated(
        new CaseCreatedEvent('case-1', 'VV001', 'user-a'),
      );

      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('catches exceptions without rethrowing', async () => {
      mockRecipients.getAllHeadUnits.mockRejectedValue(new Error('DB down'));

      await expect(
        service.onCaseCreated(
          new CaseCreatedEvent('case-1', 'VV001', 'user-a'),
        ),
      ).resolves.toBeUndefined();
    });
  });
});
