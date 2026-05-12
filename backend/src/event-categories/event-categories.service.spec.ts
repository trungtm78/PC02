import { Test, TestingModule } from '@nestjs/testing';
import { EventCategoriesService } from './event-categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EventCategoriesService', () => {
  let service: EventCategoriesService;
  let mockPrisma: {
    eventCategory: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrisma = {
      eventCategory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventCategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EventCategoriesService>(EventCategoriesService);
  });

  describe('list()', () => {
    it('returns categories sorted by sortOrder ascending', async () => {
      const fakeRows = [
        { id: '1', slug: 'police', name: 'Ngành Công an', color: '#1e40af', sortOrder: 20 },
        { id: '2', slug: 'national', name: 'Quốc gia', color: '#dc2626', sortOrder: 10 },
      ];
      mockPrisma.eventCategory.findMany.mockResolvedValue(fakeRows);

      const result = await service.list();

      expect(result).toEqual(fakeRows);
      expect(mockPrisma.eventCategory.findMany).toHaveBeenCalledWith({
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('returns empty array when no categories exist', async () => {
      mockPrisma.eventCategory.findMany.mockResolvedValue([]);
      const result = await service.list();
      expect(result).toEqual([]);
    });
  });

  describe('findOne()', () => {
    it('returns a category by id', async () => {
      const fakeRow = {
        id: 'abc-123',
        slug: 'national',
        name: 'Quốc gia',
        color: '#dc2626',
        sortOrder: 10,
      };
      mockPrisma.eventCategory.findUnique.mockResolvedValue(fakeRow);

      const result = await service.findOne('abc-123');

      expect(result).toEqual(fakeRow);
      expect(mockPrisma.eventCategory.findUnique).toHaveBeenCalledWith({
        where: { id: 'abc-123' },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.eventCategory.findUnique.mockResolvedValue(null);
      const result = await service.findOne('nope');
      expect(result).toBeNull();
    });
  });
});
