import { Test, TestingModule } from '@nestjs/testing';
import { CalendarEventsService } from './calendar-events.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CalendarEventsService (PR 1 skeleton)', () => {
  let service: CalendarEventsService;
  let mockPrisma: {
    calendarEvent: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrisma = {
      calendarEvent: { findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarEventsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CalendarEventsService>(CalendarEventsService);
  });

  describe('findInRange()', () => {
    it('returns events whose startDate falls inside [from, to], excluding soft-deleted', async () => {
      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');
      const rows = [
        { id: 'e1', title: 'Tết', startDate: new Date('2026-01-15'), deletedAt: null },
      ];
      mockPrisma.calendarEvent.findMany.mockResolvedValue(rows);

      const result = await service.findInRange(from, to);

      expect(result).toEqual(rows);
      expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          startDate: { gte: from, lte: to },
        },
        include: { category: true },
      });
    });

    it('returns empty array when no events match', async () => {
      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      const result = await service.findInRange(new Date('2030-01-01'), new Date('2030-12-31'));
      expect(result).toEqual([]);
    });
  });
});
