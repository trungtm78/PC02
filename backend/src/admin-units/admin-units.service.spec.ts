import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminUnitsService } from './admin-units.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminUnitsService (v0.34.0.0)', () => {
  let service: AdminUnitsService;
  let prismaMock: {
    directory: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
    };
    adminUnitDatasetImport: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      directory: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      adminUnitDatasetImport: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUnitsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AdminUnitsService>(AdminUnitsService);
  });

  describe('getProvinces', () => {
    it('returns active provinces sorted by name', async () => {
      const mockProvinces = [
        { id: 'p1', code: 'HCM', name: 'TP. Hồ Chí Minh', officialCode: '79' },
      ];
      prismaMock.directory.findMany.mockResolvedValue(mockProvinces);

      const result = await service.getProvinces();

      expect(prismaMock.directory.findMany).toHaveBeenCalledWith({
        where: { type: 'PROVINCE', isActive: true },
        select: { id: true, code: true, name: true, officialCode: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(mockProvinces);
    });
  });

  describe('getWardsByProvince', () => {
    it('filters by parentId + active', async () => {
      prismaMock.directory.findMany.mockResolvedValue([]);
      await service.getWardsByProvince('province-id-1');

      expect(prismaMock.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'WARD',
            isActive: true,
            parentId: 'province-id-1',
          }),
        }),
      );
    });

    it('adds case-insensitive name search when q provided', async () => {
      prismaMock.directory.findMany.mockResolvedValue([]);
      await service.getWardsByProvince('province-id-1', 'Bến');

      expect(prismaMock.directory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'Bến', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('ignores whitespace-only q', async () => {
      prismaMock.directory.findMany.mockResolvedValue([]);
      await service.getWardsByProvince('province-id-1', '   ');

      const callArg = prismaMock.directory.findMany.mock.calls[0][0];
      expect(callArg.where.name).toBeUndefined();
    });
  });

  describe('getWardById', () => {
    it('throws NotFoundException when ward missing', async () => {
      prismaMock.directory.findFirst.mockResolvedValue(null);

      await expect(service.getWardById('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns ward + province metadata + linkedTeamsCount via _count (D3 reverse lookup)', async () => {
      prismaMock.directory.findFirst.mockResolvedValue({
        id: 'w1',
        code: 'HCM_26506_PHUONG_1',
        name: 'Phường 1',
        officialCode: '26506',
        isActive: true,
        abolishedAt: null,
        sourceVersion: 'v2024-1279',
        legalBasis: 'NQ 1279/QH15',
        importedAt: new Date('2026-05-22'),
        parentId: 'province-hcm',
        _count: { teams: 3 },
      });
      prismaMock.directory.findUnique.mockResolvedValue({
        id: 'province-hcm',
        code: 'HCM',
        name: 'TP. Hồ Chí Minh',
        officialCode: '79',
      });

      const result = await service.getWardById('w1');

      expect(result.linkedTeamsCount).toBe(3);
      expect(result.province).toEqual({
        id: 'province-hcm',
        code: 'HCM',
        name: 'TP. Hồ Chí Minh',
        officialCode: '79',
      });
      expect(result).not.toHaveProperty('_count'); // _count stripped from output
    });

    it('returns null province when ward has no parentId', async () => {
      prismaMock.directory.findFirst.mockResolvedValue({
        id: 'orphan',
        code: 'ORPHAN',
        name: 'Orphan',
        officialCode: null,
        isActive: true,
        abolishedAt: null,
        sourceVersion: null,
        legalBasis: null,
        importedAt: null,
        parentId: null,
        _count: { teams: 0 },
      });

      const result = await service.getWardById('orphan');
      expect(result.province).toBeNull();
      expect(prismaMock.directory.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('searchWards (D1 Cmd+K)', () => {
    it('returns empty for query under 1 char', async () => {
      expect(await service.searchWards('')).toEqual([]);
      expect(await service.searchWards('  ')).toEqual([]);
      expect(prismaMock.directory.findMany).not.toHaveBeenCalled();
    });

    it('searches active wards + batch loads parent provinces (no N+1)', async () => {
      prismaMock.directory.findMany
        .mockResolvedValueOnce([
          { id: 'w1', code: 'A', name: 'Phường Bến Nghé', officialCode: '1', parentId: 'p-hcm' },
          { id: 'w2', code: 'B', name: 'Phường Bến Thành', officialCode: '2', parentId: 'p-hcm' },
        ])
        .mockResolvedValueOnce([{ id: 'p-hcm', code: 'HCM', name: 'TP. Hồ Chí Minh' }]);

      const result = await service.searchWards('Bến');

      expect(result).toHaveLength(2);
      expect(result[0].province?.code).toBe('HCM');
      expect(result[1].province?.code).toBe('HCM');
      // 2 calls: wards + 1 batch province load (not N+1)
      expect(prismaMock.directory.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCurrentDatasetVersion', () => {
    it('returns active dataset metadata', async () => {
      const mockDataset = {
        version: 'v2024-1279',
        checksum: 'abc123',
        addedProvinces: 34,
        addedWards: 10051,
        updatedWards: 0,
        abolishedWards: 0,
        importedAt: new Date('2026-05-22'),
        completedAt: new Date('2026-05-22'),
      };
      prismaMock.adminUnitDatasetImport.findFirst.mockResolvedValue(mockDataset);

      const result = await service.getCurrentDatasetVersion();
      expect(result).toEqual(mockDataset);
      expect(prismaMock.adminUnitDatasetImport.findFirst).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        select: expect.any(Object),
      });
    });

    it('returns null when no active dataset', async () => {
      prismaMock.adminUnitDatasetImport.findFirst.mockResolvedValue(null);
      const result = await service.getCurrentDatasetVersion();
      expect(result).toBeNull();
    });
  });
});
