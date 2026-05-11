import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AddressMappingService } from './address-mapping.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  addressMapping: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
  addressSeedJob: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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

  // ─── Bulk seed background job (replaces crawlAndSync) ───────────────────
  describe('startSeedJob', () => {
    beforeEach(() => {
      mockPrisma.addressSeedJob = {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
    });

    it('rejects unknown province with ConflictException', async () => {
      await expect(service.startSeedJob('UNKNOWN', 'admin-001')).rejects.toThrow(ConflictException);
    });

    it('rejects when job already running for province (concurrency lock)', async () => {
      mockPrisma.addressSeedJob.findFirst.mockResolvedValue({
        id: 'existing-job',
        province: 'HCM',
        status: 'running',
      });
      await expect(service.startSeedJob('HCM', 'admin-001')).rejects.toThrow(ConflictException);
    });

    it('creates queued job + returns jobId when no conflict', async () => {
      mockPrisma.addressSeedJob.findFirst.mockResolvedValue(null);
      mockPrisma.addressSeedJob.create.mockResolvedValue({ id: 'new-job', province: 'HCM', status: 'queued' });
      const result = await service.startSeedJob('HCM', 'admin-001');
      expect(result.jobId).toBe('new-job');
      expect(result.statusUrl).toContain('/seed/status/new-job');
      expect(mockPrisma.addressSeedJob.create).toHaveBeenCalledWith({
        data: { province: 'HCM', status: 'queued', triggeredBy: 'admin-001' },
      });
    });
  });

  describe('cancelSeedJob', () => {
    beforeEach(() => {
      mockPrisma.addressSeedJob = mockPrisma.addressSeedJob || { findUnique: jest.fn(), update: jest.fn() };
    });

    it('throws NotFoundException for unknown job', async () => {
      mockPrisma.addressSeedJob.findUnique.mockResolvedValue(null);
      await expect(service.cancelSeedJob('missing')).rejects.toThrow(NotFoundException);
    });

    it('rejects already-completed jobs with ConflictException', async () => {
      mockPrisma.addressSeedJob.findUnique.mockResolvedValue({ id: 'j1', status: 'completed' });
      await expect(service.cancelSeedJob('j1')).rejects.toThrow(ConflictException);
    });

    it('sets cancelToken when running', async () => {
      mockPrisma.addressSeedJob.findUnique.mockResolvedValue({ id: 'j1', status: 'running' });
      mockPrisma.addressSeedJob.update.mockResolvedValue({});
      const result = await service.cancelSeedJob('j1');
      expect(result.ok).toBe(true);
      expect(mockPrisma.addressSeedJob.update).toHaveBeenCalledWith({
        where: { id: 'j1' },
        data: { cancelToken: 'requested' },
      });
    });
  });

  // Bàn Cờ regression: this is the user's reported bug. After seed runs,
  // looking up "Phường 5, Quận 3, HCM" must return "Phường Bàn Cờ".
  describe('lookup — Phường 5 Quận 3 → Phường Bàn Cờ regression (Bug 2)', () => {
    it('returns Phường Bàn Cờ when DB has the seeded entry', async () => {
      mockPrisma.addressMapping.findFirst.mockResolvedValue({
        id: 'banco',
        oldWard: 'phường 5',
        oldDistrict: 'quận 3',
        newWard: 'phường bàn cờ',
        province: 'HCM',
        source: 'api-v2',
        seededAt: new Date(),
        candidates: null,
        isActive: true,
        needsReview: false,
        note: 'API-seeded',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const result = await service.lookup({
        ward: 'Phường 5', district: 'Quận 3', province: 'HCM',
      });
      expect(result).not.toBeNull();
      expect(result!.newWard).toBe('phường bàn cờ');
    });
  });
});
