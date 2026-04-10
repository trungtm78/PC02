/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DirectoryService } from './directory.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  directory: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DirectoryService', () => {
  let service: DirectoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DirectoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DirectoryService>(DirectoryService);
    jest.clearAllMocks();
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated directories', async () => {
      const fakeData = [
        { id: 'd1', type: 'CRIME', code: 'TH001', name: 'Trộm cắp' },
      ];
      mockPrisma.directory.findMany.mockResolvedValue(fakeData);
      mockPrisma.directory.count.mockResolvedValue(1);

      const result = await service.findAll({ limit: 50, offset: 0 });

      expect(result.data).toEqual(fakeData);
      expect(result.total).toBe(1);
    });

    it('filters by type', async () => {
      mockPrisma.directory.findMany.mockResolvedValue([]);
      mockPrisma.directory.count.mockResolvedValue(0);

      await service.findAll({ type: 'CRIME', limit: 50, offset: 0 });

      expect(mockPrisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'CRIME' }),
        }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns directory when found', async () => {
      const fake = { id: 'd1', type: 'CRIME', code: 'TH001' };
      mockPrisma.directory.findUnique.mockResolvedValue(fake);

      const result = await service.findOne('d1');
      expect(result).toEqual(fake);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.directory.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = { type: 'CRIME', code: 'TH001', name: 'Trộm cắp' };

    beforeEach(() => {
      mockPrisma.directory.findUnique.mockResolvedValue(null);
      mockPrisma.directory.create.mockResolvedValue({
        id: 'new-d',
        ...createDto,
      });
    });

    it('creates directory successfully', async () => {
      const result = await service.create(createDto);
      expect(result.code).toBe('TH001');
    });

    it('EC-02: throws ConflictException for duplicate type+code', async () => {
      mockPrisma.directory.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when parentId does not exist', async () => {
      // First call for type_code uniqueness = null (no conflict)
      // Second call for parentId lookup = null (not found)
      mockPrisma.directory.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.create({ ...createDto, parentId: 'nonexistent-parent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when parent has different type', async () => {
      mockPrisma.directory.findUnique
        .mockResolvedValueOnce(null) // no dup
        .mockResolvedValueOnce({ id: 'p1', type: 'ORG' }); // parent with wrong type

      await expect(
        service.create({ ...createDto, parentId: 'p1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes directory when no children', async () => {
      mockPrisma.directory.findUnique.mockResolvedValue({
        id: 'd1',
        name: 'Test',
      });
      mockPrisma.directory.count.mockResolvedValue(0);
      mockPrisma.directory.delete.mockResolvedValue({});

      const result = await service.remove('d1');
      expect(result.message).toContain('xóa');
    });

    it('throws NotFoundException when directory not found', async () => {
      mockPrisma.directory.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('EC-01: throws BadRequestException when directory has children', async () => {
      mockPrisma.directory.findUnique.mockResolvedValue({
        id: 'd1',
        name: 'Parent',
      });
      mockPrisma.directory.count.mockResolvedValue(3);

      await expect(service.remove('d1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── findAll with filters ────────────────────────────────────────────────

  describe('findAll (filters)', () => {
    it('filters by search term', async () => {
      mockPrisma.directory.findMany.mockResolvedValue([]);
      mockPrisma.directory.count.mockResolvedValue(0);

      await service.findAll({ search: 'trộm', limit: 50, offset: 0 });

      expect(mockPrisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it('filters by parentId', async () => {
      mockPrisma.directory.findMany.mockResolvedValue([]);
      mockPrisma.directory.count.mockResolvedValue(0);

      await service.findAll({ parentId: 'p1', limit: 50, offset: 0 });

      expect(mockPrisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ parentId: 'p1' }),
        }),
      );
    });

    it('filters by parentId=null for root items', async () => {
      mockPrisma.directory.findMany.mockResolvedValue([]);
      mockPrisma.directory.count.mockResolvedValue(0);

      await service.findAll({ parentId: 'null', limit: 50, offset: 0 });

      expect(mockPrisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ parentId: null }),
        }),
      );
    });

    it('filters by isActive', async () => {
      mockPrisma.directory.findMany.mockResolvedValue([]);
      mockPrisma.directory.count.mockResolvedValue(0);

      await service.findAll({ isActive: true, limit: 50, offset: 0 });

      expect(mockPrisma.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  // ── findTypes ─────────────────────────────────────────────────────────────

  describe('findTypes', () => {
    it('returns distinct types', async () => {
      mockPrisma.directory.findMany.mockResolvedValue([
        { type: 'CRIME' },
        { type: 'ORG' },
      ]);

      const result = await service.findTypes();
      expect(result).toEqual(['CRIME', 'ORG']);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates directory successfully', async () => {
      mockPrisma.directory.findUnique.mockResolvedValue({
        id: 'd1',
        code: 'OLD',
        type: 'CRIME',
        parentId: null,
      });
      mockPrisma.directory.update.mockResolvedValue({
        id: 'd1',
        name: 'Updated',
      });

      const result = await service.update('d1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException when directory not found', async () => {
      mockPrisma.directory.findUnique.mockResolvedValue(null);
      await expect(service.update('bad', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('EC-03: throws BadRequestException for circular hierarchy', async () => {
      const childId = 'child-id';

      mockPrisma.directory.findUnique.mockResolvedValue({
        id: 'd1',
        code: 'P1',
        type: 'CRIME',
        parentId: null,
      });

      mockPrisma.directory.findMany
        .mockResolvedValueOnce([{ id: childId }])
        .mockResolvedValueOnce([]);

      await expect(service.update('d1', { parentId: childId })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('EC-02: throws ConflictException for duplicate code on update', async () => {
      mockPrisma.directory.findUnique
        .mockResolvedValueOnce({
          id: 'd1',
          code: 'OLD',
          type: 'CRIME',
          parentId: null,
        })
        .mockResolvedValueOnce({ id: 'd2' });

      await expect(service.update('d1', { code: 'DUP' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── seedSampleData ────────────────────────────────────────────────────────

  describe('seedSampleData', () => {
    it('upserts all sample records', async () => {
      mockPrisma.directory.upsert.mockResolvedValue({});

      const result = await service.seedSampleData();
      expect(result.message).toContain('seed');
      expect(mockPrisma.directory.upsert).toHaveBeenCalledTimes(12); // 4 CRIME + 2 ORG + 2 LOCATION + 4 STATUS
    });
  });
});
