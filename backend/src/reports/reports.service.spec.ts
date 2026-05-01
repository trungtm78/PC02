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
    findMany: jest.fn().mockResolvedValue([]),
  },
  incident: {
    count: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
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

function makeOverdueCase(daysOverdue: number, overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const deadline = new Date(now.getTime() - daysOverdue * 24 * 60 * 60 * 1000);
  return {
    id: `case-${daysOverdue}d`,
    name: `Vụ án trễ ${daysOverdue} ngày`,
    deadline,
    createdAt: new Date(deadline.getTime() - 30 * 24 * 60 * 60 * 1000),
    unit: 'Đội 1',
    status: 'DANG_DIEU_TRA',
    investigator: { id: 'inv-1', firstName: 'Nguyễn', lastName: 'Văn A' },
    ...overrides,
  };
}

function makeOverdueIncident(daysOverdue: number) {
  const now = new Date();
  const deadline = new Date(now.getTime() - daysOverdue * 24 * 60 * 60 * 1000);
  return {
    id: `incident-${daysOverdue}d`,
    name: `Vụ việc trễ ${daysOverdue} ngày`,
    deadline,
    createdAt: new Date(deadline.getTime() - 10 * 24 * 60 * 60 * 1000),
    unitId: 'unit-1',
    status: 'DANG_XAC_MINH',
    investigator: null,
  };
}

function makeOverduePetition(daysOverdue: number) {
  const now = new Date();
  const deadline = new Date(now.getTime() - daysOverdue * 24 * 60 * 60 * 1000);
  return {
    id: `petition-${daysOverdue}d`,
    stt: `DT-2026-00001`,
    summary: `Đơn thư trễ ${daysOverdue} ngày`,
    deadline,
    receivedDate: new Date(deadline.getTime() - 15 * 24 * 60 * 60 * 1000),
    unit: 'Đội 2',
    status: 'DANG_XU_LY',
    priority: null,
    assignedTo: null,
  };
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

  // ── getOverdue ─────────────────────────────────────────────────────────────
  // These tests protect the /reports/overdue endpoint used by OverdueRecordsPage.
  // The frontend relies on: result.success, result.data[].id, recordType, title,
  // assignedTo, unit, dueDate, receivedDate, daysOverdue, status, priority.

  describe('getOverdue', () => {
    beforeEach(() => {
      mockPrisma.case.findMany.mockResolvedValue([]);
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.petition.findMany.mockResolvedValue([]);
    });

    it('returns { success: true, data, total } shape (frontend contract)', async () => {
      mockPrisma.case.findMany.mockResolvedValue([makeOverdueCase(5)]);
      const result = await service.getOverdue();
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('each record has required frontend fields', async () => {
      mockPrisma.case.findMany.mockResolvedValue([makeOverdueCase(10)]);
      const result = await service.getOverdue();
      const rec = result.data[0];
      expect(rec).toHaveProperty('id');
      expect(rec).toHaveProperty('recordType', 'case');
      expect(rec).toHaveProperty('recordNumber');
      expect(rec).toHaveProperty('title');
      expect(rec).toHaveProperty('assignedTo');
      expect(rec).toHaveProperty('unit');
      expect(rec).toHaveProperty('dueDate');
      expect(rec).toHaveProperty('receivedDate');
      expect(rec).toHaveProperty('daysOverdue');
      expect(rec).toHaveProperty('status');
      expect(rec).toHaveProperty('priority');
    });

    it('assigns priority: critical when daysOverdue > 30', async () => {
      mockPrisma.case.findMany.mockResolvedValue([makeOverdueCase(35)]);
      const result = await service.getOverdue();
      expect(result.data[0].priority).toBe('critical');
    });

    it('assigns priority: high when daysOverdue 15-30', async () => {
      mockPrisma.case.findMany.mockResolvedValue([makeOverdueCase(20)]);
      const result = await service.getOverdue();
      expect(result.data[0].priority).toBe('high');
    });

    it('assigns priority: medium when daysOverdue <= 14', async () => {
      mockPrisma.case.findMany.mockResolvedValue([makeOverdueCase(7)]);
      const result = await service.getOverdue();
      expect(result.data[0].priority).toBe('medium');
    });

    it('sorts result by daysOverdue descending (most overdue first)', async () => {
      mockPrisma.case.findMany.mockResolvedValue([
        makeOverdueCase(5),
        makeOverdueCase(40),
        makeOverdueCase(15),
      ]);
      const result = await service.getOverdue();
      expect(result.data[0].daysOverdue).toBeGreaterThan(result.data[1].daysOverdue);
      expect(result.data[1].daysOverdue).toBeGreaterThan(result.data[2].daysOverdue);
    });

    it('filters by minDaysOverdue', async () => {
      mockPrisma.case.findMany.mockResolvedValue([
        makeOverdueCase(3),
        makeOverdueCase(10),
        makeOverdueCase(25),
      ]);
      const result = await service.getOverdue(undefined, undefined, undefined, 7);
      expect(result.data.every(r => r.daysOverdue >= 7)).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('filters by recordType=case (skips incidents and petitions)', async () => {
      mockPrisma.case.findMany.mockResolvedValue([makeOverdueCase(5)]);
      await service.getOverdue(undefined, 'case');
      expect(mockPrisma.incident.findMany).not.toHaveBeenCalled();
    });

    it('uses investigator name when present, falls back to Chưa phân công', async () => {
      mockPrisma.case.findMany.mockResolvedValue([makeOverdueCase(5)]);
      const withInvestigator = await service.getOverdue();
      expect(withInvestigator.data[0].assignedTo).toBe('Nguyễn Văn A');

      mockPrisma.case.findMany.mockResolvedValue([makeOverdueCase(5, { investigator: null })]);
      const withoutInvestigator = await service.getOverdue();
      expect(withoutInvestigator.data[0].assignedTo).toBe('Chưa phân công');
    });

    it('returns empty data when no overdue records', async () => {
      const result = await service.getOverdue();
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
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

    // ── API CONTRACT TESTS (protect frontend transform) ──────────────────────
    // These tests document the exact response shape the frontend Stat48ReportPage
    // transform function depends on. If the backend changes shape, these fail,
    // reminding developers to also update the frontend transformer.

    it('[CONTRACT] response uses nullCount (not casesWithoutData)', async () => {
      mockPrisma.case.findMany.mockResolvedValue([
        { metadata: null },
        makeCaseWithStat48({ 'Loại nguồn tin': 'A' }),
      ]);

      const result = await service.getStat48('2025-01-01', '2025-12-31');

      // Frontend reads: raw.nullCount, raw.nullRatePct
      expect(result).toHaveProperty('nullCount', 1);
      expect(result).toHaveProperty('nullRatePct', 50);
      // NOT casesWithoutData or missingPercent
      expect(result).not.toHaveProperty('casesWithoutData');
      expect(result).not.toHaveProperty('missingPercent');
    });

    it('[CONTRACT] field shape uses .field (not .fieldName) and .dataCount (not .count)', async () => {
      mockPrisma.case.findMany.mockResolvedValue([
        makeCaseWithStat48({ 'Loại nguồn tin': 'Tin báo' }),
      ]);

      const result = await service.getStat48('2025-01-01', '2025-12-31');

      const anyField = result.groups[0].fields[0];
      expect(anyField).toHaveProperty('field');      // NOT fieldName
      expect(anyField).toHaveProperty('dataCount');  // NOT count
      expect(anyField).toHaveProperty('nullCount');  // NOT missing/missingCount
      expect(anyField).not.toHaveProperty('fieldName');
      expect(anyField).not.toHaveProperty('count');
    });

    it('[CONTRACT] categorical distribution is Record<string,number> (not array)', async () => {
      mockPrisma.case.findMany.mockResolvedValue([
        makeCaseWithStat48({ 'Loại nguồn tin': 'Tin báo' }),
        makeCaseWithStat48({ 'Loại nguồn tin': 'Tin báo' }),
        makeCaseWithStat48({ 'Loại nguồn tin': 'Tố giác' }),
      ]);

      const result = await service.getStat48('2025-01-01', '2025-12-31');

      const group1 = result.groups.find((g) => g.name === 'Nhóm 1: Nguồn tin')!;
      const field = group1.fields.find((f) => f.field === 'Loại nguồn tin')!;
      // Backend returns plain object; frontend transform converts to [{value,count}] array
      expect(field.distribution).toEqual(expect.any(Object));
      expect(Array.isArray(field.distribution)).toBe(false);
      expect(field.distribution).toHaveProperty('Tin báo', 2);
      expect(field.distribution).toHaveProperty('Tố giác', 1);
    });

    it('[CONTRACT] group shape uses .name (not .groupName), no .groupIndex', async () => {
      mockPrisma.case.findMany.mockResolvedValue([makeCaseWithStat48({})]);

      const result = await service.getStat48('2025-01-01', '2025-12-31');

      const group = result.groups[0];
      expect(group).toHaveProperty('name');        // NOT groupName
      expect(group).not.toHaveProperty('groupName');
      expect(group).not.toHaveProperty('groupIndex');
    });
  });
});
