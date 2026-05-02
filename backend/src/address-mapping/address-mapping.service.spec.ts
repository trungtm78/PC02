import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AddressMappingService } from './address-mapping.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  addressMapping: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const SAMPLE_MAPPING = {
  id: 'm1',
  oldWard: 'phường 14',
  oldDistrict: 'quận phú nhuận',
  newWard: 'phường phú nhuận',
  province: 'HCM',
  note: 'NQ 1279',
  isActive: true,
  needsReview: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AddressMappingService', () => {
  let service: AddressMappingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressMappingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AddressMappingService>(AddressMappingService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated results', async () => {
      mockPrisma.addressMapping.findMany.mockResolvedValue([SAMPLE_MAPPING]);
      mockPrisma.addressMapping.count.mockResolvedValue(1);
      const result = await service.findAll({ limit: 50, offset: 0 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('filters by province', async () => {
      mockPrisma.addressMapping.findMany.mockResolvedValue([]);
      mockPrisma.addressMapping.count.mockResolvedValue(0);
      await service.findAll({ province: 'HCM', limit: 50, offset: 0 });
      expect(mockPrisma.addressMapping.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ province: 'HCM' }) }),
      );
    });
  });

  describe('lookup', () => {
    it('finds mapping case-insensitively', async () => {
      mockPrisma.addressMapping.findFirst.mockResolvedValue(SAMPLE_MAPPING);
      const result = await service.lookup({ ward: 'Phường 14', district: 'Quận Phú Nhuận', province: 'HCM' });
      expect(result).toEqual(SAMPLE_MAPPING);
      expect(mockPrisma.addressMapping.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            oldWard: expect.objectContaining({ equals: 'phường 14' }),
            oldDistrict: expect.objectContaining({ equals: 'quận phú nhuận' }),
          }),
        }),
      );
    });

    it('uses district-level fallback when ward not in DB but district is unambiguous', async () => {
      // phường 14 not in DB but all phường of quận phú nhuận → same newWard
      mockPrisma.addressMapping.findFirst.mockResolvedValue(null); // no exact match
      mockPrisma.addressMapping.findMany.mockResolvedValue([{ newWard: 'phường phú nhuận' }]); // 1 distinct newWard
      const result = await service.lookup({ ward: 'phường 14', district: 'quận phú nhuận', province: 'HCM' });
      expect(result).not.toBeNull();
      expect(result?.newWard).toBe('phường phú nhuận');
    });

    it('returns null when no mapping found and district is ambiguous', async () => {
      mockPrisma.addressMapping.findFirst.mockResolvedValue(null);
      mockPrisma.addressMapping.findMany.mockResolvedValue([]); // no district records
      const result = await service.lookup({ ward: 'phường xyz', district: 'quận abc' });
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates new mapping', async () => {
      mockPrisma.addressMapping.findUnique.mockResolvedValue(null);
      mockPrisma.addressMapping.create.mockResolvedValue(SAMPLE_MAPPING);
      const result = await service.create({
        oldWard: 'phường 14', oldDistrict: 'quận phú nhuận',
        newWard: 'phường phú nhuận', province: 'HCM',
      });
      expect(result).toEqual(SAMPLE_MAPPING);
    });

    it('throws ConflictException for duplicate', async () => {
      mockPrisma.addressMapping.findUnique.mockResolvedValue(SAMPLE_MAPPING);
      await expect(service.create({
        oldWard: 'phường 14', oldDistrict: 'quận phú nhuận',
        newWard: 'phường phú nhuận', province: 'HCM',
      })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes existing mapping', async () => {
      mockPrisma.addressMapping.findUnique.mockResolvedValue(SAMPLE_MAPPING);
      mockPrisma.addressMapping.delete.mockResolvedValue(SAMPLE_MAPPING);
      const result = await service.remove('m1');
      expect(result.message).toContain('m1');
    });

    it('throws NotFoundException for missing mapping', async () => {
      mockPrisma.addressMapping.findUnique.mockResolvedValue(null);
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
