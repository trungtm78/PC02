/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * ReportsService Unit Tests
 *
 * getStat48:
 *   - SUM for numeric fields (Thiệt hại VNĐ)
 *   - COUNT BY VALUE for categorical fields (Loại nguồn tin)
 *   - sets isDraft=true when nullRatePct > 50
 *   - logs warning when cases.length > 2000
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  petition: {
    count: jest.fn(),
  },
  incident: {
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  case: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCaseWithStat48(stat48: Record<string, unknown>) {
  return { metadata: { stat48 } };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  // ── getStat48 ──────────────────────────────────────────────────────────────

  describe('getStat48', () => {
    it('SUM for numeric fields (Thiệt hại VNĐ)', async () => {
      mockPrisma.case.findMany.mockResolvedValue([
        makeCaseWithStat48({ 'Thiệt hại (VNĐ)': '1000000' }),
        makeCaseWithStat48({ 'Thiệt hại (VNĐ)': '2000000' }),
        makeCaseWithStat48({}),
      ]);

      const result = await service.getStat48('2025-01-01', '2025-12-31');

      const group2 = result.groups.find((g) => g.name === 'Nhóm 2: Tội phạm');
      expect(group2).toBeDefined();
      const thietHaiField = group2!.fields.find((f) => f.field === 'Thiệt hại (VNĐ)');
      expect(thietHaiField).toBeDefined();
      expect(thietHaiField!.type).toBe('numeric');
      expect(thietHaiField!.total).toBe(3000000);
      expect(thietHaiField!.dataCount).toBe(2);
      expect(thietHaiField!.nullCount).toBe(1);
    });

    it('COUNT BY VALUE for categorical fields (Loại nguồn tin)', async () => {
      mockPrisma.case.findMany.mockResolvedValue([
        makeCaseWithStat48({ 'Loại nguồn tin': 'Tin báo dân' }),
        makeCaseWithStat48({ 'Loại nguồn tin': 'Tin báo dân' }),
        makeCaseWithStat48({ 'Loại nguồn tin': 'Tố giác' }),
        makeCaseWithStat48({}),
      ]);

      const result = await service.getStat48('2025-01-01', '2025-12-31');

      const group1 = result.groups.find((g) => g.name === 'Nhóm 1: Nguồn tin');
      expect(group1).toBeDefined();
      const loaiNguonTinField = group1!.fields.find((f) => f.field === 'Loại nguồn tin');
      expect(loaiNguonTinField).toBeDefined();
      expect(loaiNguonTinField!.type).toBe('categorical');
      expect(loaiNguonTinField!.distribution).toEqual({
        'Tin báo dân': 2,
        'Tố giác': 1,
      });
      expect(loaiNguonTinField!.dataCount).toBe(3);
      expect(loaiNguonTinField!.nullCount).toBe(1);
    });

    it('sets isDraft=true when nullRatePct > 50', async () => {
      // 3 out of 4 cases have no stat48 key (metadata.stat48 is falsy) → nullRatePct = 75%
      mockPrisma.case.findMany.mockResolvedValue([
        { metadata: null },
        { metadata: {} },
        { metadata: { other: 'x' } },
        makeCaseWithStat48({ 'Loại nguồn tin': 'Tin báo dân' }),
      ]);

      const result = await service.getStat48('2025-01-01', '2025-12-31');

      expect(result.isDraft).toBe(true);
      expect(result.nullRatePct).toBeGreaterThan(50);
    });

    it('sets isDraft=false when nullRatePct <= 50', async () => {
      // 1 out of 4 cases has no stat48 → nullRatePct = 25%
      mockPrisma.case.findMany.mockResolvedValue([
        makeCaseWithStat48({ 'Loại nguồn tin': 'A' }),
        makeCaseWithStat48({ 'Loại nguồn tin': 'B' }),
        makeCaseWithStat48({ 'Loại nguồn tin': 'C' }),
        makeCaseWithStat48({}),
      ]);

      const result = await service.getStat48('2025-01-01', '2025-12-31');

      expect(result.isDraft).toBe(false);
    });

    it('logs warning when cases.length > 2000', async () => {
      // Build 2001 cases
      const manyCases = Array.from({ length: 2001 }, () =>
        makeCaseWithStat48({}),
      );
      mockPrisma.case.findMany.mockResolvedValue(manyCases);

      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      await service.getStat48('2020-01-01', '2025-12-31');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('2001 cases'),
      );
    });

    it('returns totalCases and correct group structure', async () => {
      mockPrisma.case.findMany.mockResolvedValue([
        makeCaseWithStat48({ 'Loại nguồn tin': 'Tin báo' }),
        makeCaseWithStat48({ 'Loại nguồn tin': 'Tin báo' }),
      ]);

      const result = await service.getStat48('2025-01-01', '2025-12-31');

      expect(result.totalCases).toBe(2);
      expect(result.groups).toHaveLength(4);
      expect(result.groups[0].name).toBe('Nhóm 1: Nguồn tin');
      expect(result.groups[1].name).toBe('Nhóm 2: Tội phạm');
      expect(result.groups[2].name).toBe('Nhóm 3: Đối tượng');
      expect(result.groups[3].name).toBe('Nhóm 4: Kết quả');
    });

    it('filters by unit when provided', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);

      await service.getStat48('2025-01-01', '2025-12-31', 'Quận 1');

      const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
      expect(callArgs.where.unit).toBe('Quận 1');
    });

    it('does NOT filter by unit when unit is undefined', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);

      await service.getStat48('2025-01-01', '2025-12-31');

      const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
      expect(callArgs.where.unit).toBeUndefined();
    });
  });
});
