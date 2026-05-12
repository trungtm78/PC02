import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventCategoriesService } from './event-categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EventCategoriesService', () => {
  let service: EventCategoriesService;
  let mockPrisma: {
    eventCategory: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    calendarEvent: {
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrisma = {
      eventCategory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      calendarEvent: {
        count: jest.fn(),
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

  describe('create()', () => {
    it('creates a category with sortOrder default 100 when not provided', async () => {
      mockPrisma.eventCategory.findFirst.mockResolvedValue(null); // no slug conflict
      const fakeRow = { id: 'new-id', slug: 'training', name: 'Tập huấn', color: '#f97316', sortOrder: 100, isSystem: false };
      mockPrisma.eventCategory.create.mockResolvedValue(fakeRow);

      const result = await service.create({ slug: 'training', name: 'Tập huấn', color: '#f97316' });

      expect(result).toEqual(fakeRow);
      expect(mockPrisma.eventCategory.create).toHaveBeenCalledWith({
        data: { slug: 'training', name: 'Tập huấn', color: '#f97316', icon: null, sortOrder: 100, isSystem: false },
      });
    });

    it('rejects creation when slug already exists', async () => {
      mockPrisma.eventCategory.findFirst.mockResolvedValue({ id: 'existing', slug: 'national' });

      await expect(
        service.create({ slug: 'national', name: 'Quốc gia khác', color: '#ff0000' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.eventCategory.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('updates name/color/icon/sortOrder but never slug or isSystem', async () => {
      mockPrisma.eventCategory.findUnique.mockResolvedValue({
        id: 'abc',
        slug: 'national',
        name: 'Quốc gia',
        color: '#dc2626',
        isSystem: true,
        sortOrder: 10,
      });
      mockPrisma.eventCategory.update.mockResolvedValue({
        id: 'abc',
        slug: 'national',
        name: 'Quốc gia VN',
        color: '#dc2626',
        isSystem: true,
        sortOrder: 5,
      });

      // Caller tries to sneak slug/isSystem changes — must be filtered out.
      const result = await service.update('abc', {
        name: 'Quốc gia VN',
        sortOrder: 5,
        slug: 'hacked',
        isSystem: false,
      } as any);

      expect(result.name).toBe('Quốc gia VN');
      const updateCall = mockPrisma.eventCategory.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: 'abc' });
      expect(updateCall.data.slug).toBeUndefined();
      expect(updateCall.data.isSystem).toBeUndefined();
      expect(updateCall.data.name).toBe('Quốc gia VN');
      expect(updateCall.data.sortOrder).toBe(5);
    });

    it('throws NotFoundException when category does not exist', async () => {
      mockPrisma.eventCategory.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('refuses to delete isSystem=true category', async () => {
      mockPrisma.eventCategory.findUnique.mockResolvedValue({
        id: 'sys-1',
        slug: 'national',
        isSystem: true,
      });

      await expect(service.remove('sys-1')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.eventCategory.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete when category still has events', async () => {
      mockPrisma.eventCategory.findUnique.mockResolvedValue({
        id: 'cat-1',
        slug: 'training',
        isSystem: false,
      });
      mockPrisma.calendarEvent.count.mockResolvedValue(5);

      await expect(service.remove('cat-1')).rejects.toThrow(ConflictException);
      expect(mockPrisma.eventCategory.delete).not.toHaveBeenCalled();
    });

    it('deletes a non-system, empty category', async () => {
      mockPrisma.eventCategory.findUnique.mockResolvedValue({
        id: 'cat-1',
        slug: 'training',
        isSystem: false,
      });
      mockPrisma.calendarEvent.count.mockResolvedValue(0);
      mockPrisma.eventCategory.delete.mockResolvedValue({ id: 'cat-1' });

      const result = await service.remove('cat-1');
      expect(result).toEqual({ id: 'cat-1' });
      expect(mockPrisma.eventCategory.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
    });

    it('throws NotFoundException when category does not exist', async () => {
      mockPrisma.eventCategory.findUnique.mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
