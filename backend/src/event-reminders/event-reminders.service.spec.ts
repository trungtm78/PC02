import { Test, TestingModule } from '@nestjs/testing';
import { EventRemindersService } from './event-reminders.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EventRemindersService (PR 1 skeleton)', () => {
  let service: EventRemindersService;
  let mockPrisma: {
    eventReminder: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    mockPrisma = {
      eventReminder: { findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventRemindersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<EventRemindersService>(EventRemindersService);
  });

  describe('listForEvent()', () => {
    it('returns reminders for a given event owned by the current user', async () => {
      const rows = [
        { id: 'r1', eventId: 'e1', userId: 'u1', minutesBefore: 30, channels: ['FCM'] },
      ];
      mockPrisma.eventReminder.findMany.mockResolvedValue(rows);

      const result = await service.listForEvent('e1', 'u1');

      expect(result).toEqual(rows);
      expect(mockPrisma.eventReminder.findMany).toHaveBeenCalledWith({
        where: { eventId: 'e1', userId: 'u1' },
        orderBy: { minutesBefore: 'asc' },
      });
    });

    it('returns empty array when user has no reminders for the event', async () => {
      mockPrisma.eventReminder.findMany.mockResolvedValue([]);
      const result = await service.listForEvent('e1', 'u1');
      expect(result).toEqual([]);
    });
  });
});
