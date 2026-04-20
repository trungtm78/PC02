/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * KpiService Unit Tests
 *
 * UT-001: calculateKpi1 – 100% khi tất cả đã thụ lý
 * UT-002: calculateKpi1 – <100% khi có vụ chưa thụ lý
 * UT-003: calculateKpi2 – tỷ lệ giải quyết đúng (>90%)
 * UT-004: calculateKpi2 – đúng danh sách terminal statuses giải quyết
 * UT-005: calculateKpi3 – tỷ lệ khám phá án (>80%)
 * UT-006: calculateKpi3 – Case.status filter đúng các trạng thái khám phá
 * UT-007: calculateKpi4 – tỷ lệ án rất/đặc biệt nghiêm trọng >95%
 * UT-008: calculateKpi4 – chỉ lọc severity RAT_NT + DAC_BIET_NT
 * UT-009: getKpiSummary – trả đủ 4 KPI với status PASS/FAIL/WARNING
 * UT-010: getKpiSummary – filter đúng theo period (year/quarter/month)
 * UT-011: getKpiTrend  – trả 12 tháng xu hướng cho từng KPI
 * UT-012: getKpiSummary – scope filter theo unitId/teamId
 * UT-013: getKpiByTeam  – trả array [{team, summary}] chỉ cho teams level=1
 * UT-014: getKpiByTeam  – truyền year/quarter/month xuống getKpiSummary đúng
 * UT-015: getKpiByTeam  – trả [] khi không có active teams level=1
 */

import { Test, TestingModule } from '@nestjs/testing';
import { KpiService, KPI2_RESOLVED_STATUSES, KPI3_SOLVED_CASE_STATUSES } from './kpi.service';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentStatus, CaseStatus } from '@prisma/client';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  incident: {
    count: jest.fn(),
  },
  case: {
    count: jest.fn(),
  },
  team: {
    findMany: jest.fn(),
  },
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('KpiService', () => {
  let service: KpiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KpiService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<KpiService>(KpiService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─── UT-001: calculateKpi1 – 100% khi tất cả đã thụ lý ─────────────────

  describe('calculateKpi1', () => {
    it('UT-001: trả value=100 và status=PASS khi tất cả incidents đã thụ lý', async () => {
      // Arrange: 10 total, 10 đã thụ lý (status != TIEP_NHAN)
      mockPrisma.incident.count
        .mockResolvedValueOnce(10)  // total
        .mockResolvedValueOnce(10); // thuLy (status != TIEP_NHAN)

      // Act
      const result = await service.calculateKpi1({ year: 2026 });

      // Assert
      expect(result.kpi).toBe(1);
      expect(result.value).toBe(100);
      expect(result.status).toBe('PASS');
      expect(result.numerator).toBe(10);
      expect(result.denominator).toBe(10);
      expect(result.target).toBe(100);
      expect(result.noData).toBe(false);
      expect(result.label).toBeTruthy();
    });

    // B-001 FIX: denominator=0 now returns N_A, not 100% PASS
    it('UT-001: trả status=N_A khi denominator=0 (không có vụ nào trong kỳ)', async () => {
      // Arrange: 0 total
      mockPrisma.incident.count
        .mockResolvedValueOnce(0)  // total
        .mockResolvedValueOnce(0); // thuLy

      // Act
      const result = await service.calculateKpi1({ year: 2026 });

      // Assert: no data → N_A, not inflated to 100% PASS
      expect(result.status).toBe('N_A');
      expect(result.noData).toBe(true);
      expect(result.value).toBe(0);
      expect(result.denominator).toBe(0);
    });

    // ─── UT-002: calculateKpi1 – <100% khi có vụ chưa thụ lý ─────────────

    it('UT-002: trả value<100 và status=FAIL khi có incidents chưa thụ lý', async () => {
      // Arrange: 10 total, 6 đã thụ lý → 60%
      mockPrisma.incident.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(6); // thuLy

      // Act
      const result = await service.calculateKpi1({ year: 2026 });

      // Assert
      expect(result.value).toBe(60);
      expect(result.status).toBe('FAIL');
      expect(result.numerator).toBe(6);
      expect(result.denominator).toBe(10);
      expect(result.noData).toBe(false);
    });

    it('UT-002: trả status=WARNING khi 95%<=value<100%', async () => {
      // Arrange: 20 total, 19 đã thụ lý → 95%
      mockPrisma.incident.count
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(19); // thuLy

      // Act
      const result = await service.calculateKpi1({ year: 2026 });

      // Assert
      expect(result.value).toBe(95);
      expect(result.status).toBe('WARNING');
    });

    // B-002 FIX: assert on first count call shape (deletedAt, createdAt, scope filters)
    it('UT-001: first count call includes deletedAt:null + createdAt year range', async () => {
      mockPrisma.incident.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);

      await service.calculateKpi1({ year: 2026 });

      const firstCall = mockPrisma.incident.count.mock.calls[0][0];
      expect(firstCall.where.deletedAt).toBeNull();
      // createdAt should be a range with gte/lt for year 2026
      expect(firstCall.where.createdAt).toEqual({
        gte: new Date(2026, 0, 1),
        lt: new Date(2027, 0, 1),
      });
    });

    it('UT-001: second count call filters status != TIEP_NHAN', async () => {
      mockPrisma.incident.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);

      await service.calculateKpi1({ year: 2026 });

      const secondCall = mockPrisma.incident.count.mock.calls[1][0];
      expect(secondCall.where.status).toEqual({ not: IncidentStatus.TIEP_NHAN });
    });

    it('UT-012: unitId scope is passed to both count calls', async () => {
      mockPrisma.incident.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(3);

      await service.calculateKpi1({ year: 2026, unitId: 'unit-abc' });

      const firstCall = mockPrisma.incident.count.mock.calls[0][0];
      const secondCall = mockPrisma.incident.count.mock.calls[1][0];
      expect(firstCall.where.unitId).toBe('unit-abc');
      expect(secondCall.where.unitId).toBe('unit-abc');
    });

    it('UT-012: teamId scope is passed to both count calls', async () => {
      mockPrisma.incident.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(3);

      await service.calculateKpi1({ year: 2026, teamId: 'team-xyz' });

      const firstCall = mockPrisma.incident.count.mock.calls[0][0];
      expect(firstCall.where.assignedTeamId).toBe('team-xyz');
    });

    // B-003 FIX: rounding behavior for non-integer percentages
    it('UT-001: safePercent rounds correctly to 2 decimal places (1/3 = 33.33)', async () => {
      // Arrange: 3 total, 1 đã thụ lý → 33.33...%
      mockPrisma.incident.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);

      const result = await service.calculateKpi1({ year: 2026 });

      expect(result.value).toBe(33.33);
      expect(result.status).toBe('FAIL');
    });

    it('UT-001: safePercent rounds correctly (2/3 = 66.67)', async () => {
      mockPrisma.incident.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);

      const result = await service.calculateKpi1({ year: 2026 });

      expect(result.value).toBe(66.67);
    });
  });

  // ─── KPI2_RESOLVED_STATUSES constant export ───────────────────────────────

  describe('KPI2_RESOLVED_STATUSES', () => {
    it('UT-004: bao gồm đúng 6 terminal statuses giải quyết', () => {
      expect(KPI2_RESOLVED_STATUSES).toContain(IncidentStatus.DA_GIAI_QUYET);
      expect(KPI2_RESOLVED_STATUSES).toContain(IncidentStatus.DA_CHUYEN_VU_AN);
      expect(KPI2_RESOLVED_STATUSES).toContain(IncidentStatus.KHONG_KHOI_TO);
      expect(KPI2_RESOLVED_STATUSES).toContain(IncidentStatus.CHUYEN_XPHC);
      expect(KPI2_RESOLVED_STATUSES).toContain(IncidentStatus.DA_CHUYEN_DON_VI);
      expect(KPI2_RESOLVED_STATUSES).toContain(IncidentStatus.PHAN_LOAI_DAN_SU);
      expect(KPI2_RESOLVED_STATUSES).toHaveLength(6);
    });
  });

  // ─── KPI3_SOLVED_CASE_STATUSES constant export ───────────────────────────

  describe('KPI3_SOLVED_CASE_STATUSES', () => {
    it('UT-006: bao gồm đúng 4 trạng thái khám phá của Case', () => {
      expect(KPI3_SOLVED_CASE_STATUSES).toContain(CaseStatus.DA_KET_LUAN);
      expect(KPI3_SOLVED_CASE_STATUSES).toContain(CaseStatus.DANG_TRUY_TO);
      expect(KPI3_SOLVED_CASE_STATUSES).toContain(CaseStatus.DANG_XET_XU);
      expect(KPI3_SOLVED_CASE_STATUSES).toContain(CaseStatus.DA_LUU_TRU);
      expect(KPI3_SOLVED_CASE_STATUSES).toHaveLength(4);
    });
  });

  // ─── UT-003: calculateKpi2 ───────────────────────────────────────────────

  describe('calculateKpi2', () => {
    it('UT-003: trả status=PASS khi tỷ lệ giải quyết >90%', async () => {
      mockPrisma.incident.count
        .mockResolvedValueOnce(100) // total thuLy
        .mockResolvedValueOnce(95); // resolved
      const result = await service.calculateKpi2({ year: 2026 });
      expect(result.kpi).toBe(2);
      expect(result.value).toBe(95);
      expect(result.status).toBe('PASS');
      expect(result.target).toBe(90);
    });

    it('UT-003: trả status=WARNING khi 85%<=value<90%', async () => {
      mockPrisma.incident.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(87);
      const result = await service.calculateKpi2({ year: 2026 });
      expect(result.value).toBe(87);
      expect(result.status).toBe('WARNING');
    });

    it('UT-003: trả status=FAIL khi <85%', async () => {
      mockPrisma.incident.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80);
      const result = await service.calculateKpi2({ year: 2026 });
      expect(result.value).toBe(80);
      expect(result.status).toBe('FAIL');
    });

    it('UT-003: trả N_A khi denominator=0', async () => {
      mockPrisma.incident.count.mockResolvedValue(0);
      const result = await service.calculateKpi2({ year: 2026 });
      expect(result.status).toBe('N_A');
      expect(result.noData).toBe(true);
    });

    it('UT-004: second count call filters status in KPI2_RESOLVED_STATUSES', async () => {
      mockPrisma.incident.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(9);
      await service.calculateKpi2({ year: 2026 });
      const secondCall = mockPrisma.incident.count.mock.calls[1][0];
      expect(secondCall.where.status).toHaveProperty('in');
      expect(secondCall.where.status.in).toEqual(
        expect.arrayContaining(KPI2_RESOLVED_STATUSES),
      );
    });
  });

  // ─── UT-005: calculateKpi3 ───────────────────────────────────────────────

  describe('calculateKpi3', () => {
    it('UT-005: trả status=PASS khi tỷ lệ khám phá >80%', async () => {
      mockPrisma.incident.count.mockResolvedValueOnce(0);
      mockPrisma.case.count
        .mockResolvedValueOnce(100) // total cases
        .mockResolvedValueOnce(85); // solved cases
      const result = await service.calculateKpi3({ year: 2026 });
      expect(result.kpi).toBe(3);
      expect(result.value).toBe(85);
      expect(result.status).toBe('PASS');
      expect(result.target).toBe(80);
    });

    it('UT-005: trả N_A khi không có vụ án', async () => {
      mockPrisma.incident.count.mockResolvedValueOnce(0);
      mockPrisma.case.count.mockResolvedValue(0);
      const result = await service.calculateKpi3({ year: 2026 });
      expect(result.status).toBe('N_A');
      expect(result.noData).toBe(true);
    });

    it('UT-006: second case.count filters status in KPI3_SOLVED_CASE_STATUSES', async () => {
      mockPrisma.case.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // khamPha (filtered)
      await service.calculateKpi3({ year: 2026 });
      // Promise.all order: calls[0]=total (no status), calls[1]=khamPha (with status)
      const filteredCall = mockPrisma.case.count.mock.calls[1][0];
      expect(filteredCall.where.status).toHaveProperty('in');
      expect(filteredCall.where.status.in).toEqual(
        expect.arrayContaining(KPI3_SOLVED_CASE_STATUSES),
      );
    });
  });

  // ─── UT-007: calculateKpi4 ───────────────────────────────────────────────

  describe('calculateKpi4', () => {
    it('UT-007: trả status=PASS khi tỷ lệ >95%', async () => {
      mockPrisma.case.count
        .mockResolvedValueOnce(100) // total serious cases
        .mockResolvedValueOnce(97); // solved serious
      const result = await service.calculateKpi4({ year: 2026 });
      expect(result.kpi).toBe(4);
      expect(result.value).toBe(97);
      expect(result.status).toBe('PASS');
      expect(result.target).toBe(95);
    });

    it('UT-007: trả N_A khi không có án nghiêm trọng', async () => {
      mockPrisma.case.count.mockResolvedValue(0);
      const result = await service.calculateKpi4({ year: 2026 });
      expect(result.status).toBe('N_A');
      expect(result.noData).toBe(true);
    });

    it('UT-008: first case.count filters severity RAT_NGHIEM_TRONG và DAC_BIET_NGHIEM_TRONG', async () => {
      mockPrisma.case.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(9);
      await service.calculateKpi4({ year: 2026 });
      const firstCall = mockPrisma.case.count.mock.calls[0][0];
      expect(JSON.stringify(firstCall.where)).toContain('RAT_NGHIEM_TRONG');
      expect(JSON.stringify(firstCall.where)).toContain('DAC_BIET_NGHIEM_TRONG');
    });
  });

  // ─── UT-009: getKpiSummary ────────────────────────────────────────────────

  describe('getKpiSummary', () => {
    beforeEach(() => {
      mockPrisma.incident.count.mockResolvedValue(10);
      mockPrisma.case.count.mockResolvedValue(8);
    });

    it('UT-009: trả đủ 4 KPI với status hợp lệ', async () => {
      const result = await service.getKpiSummary({ year: 2026 });
      expect(result).toHaveProperty('kpi1');
      expect(result).toHaveProperty('kpi2');
      expect(result).toHaveProperty('kpi3');
      expect(result).toHaveProperty('kpi4');
      expect(['PASS', 'FAIL', 'WARNING', 'N_A']).toContain(result.kpi1.status);
      expect(['PASS', 'FAIL', 'WARNING', 'N_A']).toContain(result.kpi4.status);
    });

    it('UT-010: period phản ánh đúng year/quarter/month trong kết quả', async () => {
      const result = await service.getKpiSummary({ year: 2025, quarter: 2 });
      expect(result.period.year).toBe(2025);
      expect(result.period.quarter).toBe(2);
      expect(result.period.month).toBeUndefined();
    });

    it('UT-010: period phản ánh đúng month', async () => {
      const result = await service.getKpiSummary({ year: 2025, month: 6 });
      expect(result.period.year).toBe(2025);
      expect(result.period.month).toBe(6);
    });
  });

  // ─── UT-011: getKpiTrend ──────────────────────────────────────────────────

  describe('getKpiTrend', () => {
    beforeEach(() => {
      mockPrisma.incident.count.mockResolvedValue(5);
      mockPrisma.case.count.mockResolvedValue(4);
    });

    it('UT-011: trả mảng 12 điểm xu hướng cho mỗi tháng', async () => {
      const result = await service.getKpiTrend(2025);
      expect(result).toHaveLength(12);
      for (let i = 0; i < 12; i++) {
        expect(result[i].month).toBe(i + 1);
        expect(result[i].year).toBe(2025);
        expect(typeof result[i].kpi1).toBe('number');
        expect(typeof result[i].kpi4).toBe('number');
      }
    });

    it('UT-011: sử dụng năm hiện tại khi không truyền year', async () => {
      const result = await service.getKpiTrend();
      expect(result).toHaveLength(12);
      expect(result[0].year).toBe(new Date().getFullYear());
    });
  });

  // ─── UT-013/014/015: getKpiByTeam ────────────────────────────────────────

  describe('getKpiByTeam', () => {
    const mockTeams = [
      { id: 'team-1', name: 'Tổ 01', code: 'TO-01', level: 1, parentId: 'nhom-1' },
      { id: 'team-2', name: 'Tổ 02', code: 'TO-02', level: 1, parentId: 'nhom-1' },
    ];

    beforeEach(() => {
      // Each getKpiSummary calls 4 calculateKpi* each needing 2 count calls → 8 calls per team
      mockPrisma.incident.count.mockResolvedValue(10);
      mockPrisma.case.count.mockResolvedValue(8);
    });

    it('UT-013: trả array [{team, summary}] với đủ 4 KPI cho mỗi team', async () => {
      mockPrisma.team.findMany.mockResolvedValueOnce(mockTeams);

      const result = await service.getKpiByTeam({ year: 2026 });

      expect(result).toHaveLength(2);
      expect(result[0].team.id).toBe('team-1');
      expect(result[0].summary).toHaveProperty('kpi1');
      expect(result[0].summary).toHaveProperty('kpi2');
      expect(result[0].summary).toHaveProperty('kpi3');
      expect(result[0].summary).toHaveProperty('kpi4');
      expect(result[1].team.id).toBe('team-2');
    });

    it('UT-013: team.findMany được gọi với filter isActive:true, level:1', async () => {
      mockPrisma.team.findMany.mockResolvedValueOnce(mockTeams);

      await service.getKpiByTeam({ year: 2026 });

      const findManyCall = mockPrisma.team.findMany.mock.calls[0][0];
      expect(findManyCall.where.isActive).toBe(true);
      expect(findManyCall.where.level).toBe(1);
    });

    it('UT-014: khi allowedTeamIds được truyền, thêm id filter vào where', async () => {
      mockPrisma.team.findMany.mockResolvedValueOnce([mockTeams[0]]);

      await service.getKpiByTeam({ year: 2026, month: 3 }, ['team-1']);

      const findManyCall = mockPrisma.team.findMany.mock.calls[0][0];
      expect(findManyCall.where.id).toEqual({ in: ['team-1'] });
    });

    it('UT-014: khi allowedTeamIds là null, không filter id (admin xem tất cả)', async () => {
      mockPrisma.team.findMany.mockResolvedValueOnce(mockTeams);

      await service.getKpiByTeam({ year: 2026 }, null);

      const findManyCall = mockPrisma.team.findMany.mock.calls[0][0];
      expect(findManyCall.where.id).toBeUndefined();
    });

    it('UT-015: trả [] khi không có active teams level=1', async () => {
      mockPrisma.team.findMany.mockResolvedValueOnce([]);

      const result = await service.getKpiByTeam({ year: 2026 });

      expect(result).toEqual([]);
    });
  });
});
