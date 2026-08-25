/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * DashboardService Unit Tests
 *
 * getStats:
 *   - returns { success: true, data } with all required count fields
 *   - returns zeroes when DB is empty
 *
 * getCharts:
 *   - returns { success: true, data: { trends, structure } }
 *   - trends array has 12 entries (one per month)
 *
 * getBadgeCounts:
 *   - returns { success: true, data } with cases/suspects/petitions/incidents/overdueRecords
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { KY_THONG_KE, TRUONG_NGAY_THONG_KE } from '../common/utils/thong-ke-ky.util';

// Kỳ thống kê: badge trên thanh menu phải đếm theo cùng kỳ với thẻ số và danh sách.
const mockSettings = {
  getKyThongKe: jest.fn(),
};

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  case: {
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  incident: {
    count: jest.fn().mockResolvedValue(0),
  },
  petition: {
    count: jest.fn().mockResolvedValue(0),
  },
  subject: {
    count: jest.fn().mockResolvedValue(0),
  },
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
    mockPrisma.case.count.mockResolvedValue(0);
    mockPrisma.incident.count.mockResolvedValue(0);
    mockPrisma.petition.count.mockResolvedValue(0);
    mockPrisma.subject.count.mockResolvedValue(0);
    mockPrisma.case.groupBy.mockResolvedValue([]);
    mockSettings.getKyThongKe.mockResolvedValue({
      ky: KY_THONG_KE.THANG_HIEN_TAI,
      truong: TRUONG_NGAY_THONG_KE.NGAY_TIEP_NHAN,
      tuNgay: '2026-08-01',
      denNgay: '2026-08-31',
    });
  });

  // ── getStats ───────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns { success: true, data } with all required count fields', async () => {
      mockPrisma.case.count
        .mockResolvedValueOnce(10) // totalCases
        .mockResolvedValueOnce(3)  // newCasesThisMonth
        .mockResolvedValueOnce(2)  // overdueCases
        .mockResolvedValueOnce(5); // processedCases
      mockPrisma.incident.count.mockResolvedValue(7);
      mockPrisma.petition.count.mockResolvedValue(4);

      const result = await service.getStats();

      expect(result).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('totalCases', 10);
      expect(result.data).toHaveProperty('newCases', 3);
      expect(result.data).toHaveProperty('overdueCases', 2);
      expect(result.data).toHaveProperty('processedCases', 5);
      expect(result.data).toHaveProperty('totalIncidents', 7);
      expect(result.data).toHaveProperty('totalPetitions', 4);
    });

    it('returns all-zero counts when DB is empty', async () => {
      const result = await service.getStats();

      expect(result.success).toBe(true);
      expect(result.data.totalCases).toBe(0);
      expect(result.data.newCases).toBe(0);
      expect(result.data.overdueCases).toBe(0);
      expect(result.data.processedCases).toBe(0);
      expect(result.data.totalIncidents).toBe(0);
      expect(result.data.totalPetitions).toBe(0);
    });

    it('calls prisma.case.count at least 3 times (total, new, overdue, processed)', async () => {
      await service.getStats();
      expect(mockPrisma.case.count.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── getCharts ──────────────────────────────────────────────────────────────

  describe('getCharts', () => {
    it('returns { success: true, data: { trends, structure } }', async () => {
      const result = await service.getCharts();

      expect(result).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('trends');
      expect(result.data).toHaveProperty('structure');
      expect(Array.isArray(result.data.trends)).toBe(true);
      expect(Array.isArray(result.data.structure)).toBe(true);
    });

    it('trends array has exactly 12 entries with month labels T1–T12', async () => {
      const result = await service.getCharts();

      expect(result.data.trends).toHaveLength(12);
      expect(result.data.trends[0].month).toBe('T1');
      expect(result.data.trends[11].month).toBe('T12');
    });

    it('maps groupBy result into structure array with name and value', async () => {
      mockPrisma.case.groupBy.mockResolvedValue([
        { status: 'DANG_DIEU_TRA', _count: { id: 5 } },
        { status: 'TIEP_NHAN', _count: { id: 3 } },
      ]);

      const result = await service.getCharts();

      const structure = result.data.structure;
      expect(structure.length).toBeGreaterThanOrEqual(2);
      const investigating = structure.find((s: { name: string }) => s.name === 'Đang điều tra');
      expect(investigating).toBeDefined();
      expect(investigating!.value).toBe(5);
    });
  });

  // ── getBadgeCounts ─────────────────────────────────────────────────────────

  describe('getBadgeCounts', () => {
    it('returns { success: true, data } with all badge fields', async () => {
      mockPrisma.case.count
        .mockResolvedValueOnce(10) // totalCases
        .mockResolvedValueOnce(1); // overdueCasesCount
      mockPrisma.subject.count.mockResolvedValue(4);
      mockPrisma.petition.count.mockResolvedValue(6);
      mockPrisma.incident.count.mockResolvedValue(8);

      const result = await service.getBadgeCounts();

      expect(result).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('cases');
      expect(result.data).toHaveProperty('suspects');
      expect(result.data).toHaveProperty('petitions');
      expect(result.data).toHaveProperty('incidents');
      expect(result.data).toHaveProperty('overdueRecords');
    });
  });
});

// ── Kỳ thống kê ─────────────────────────────────────────────────────────────
// Anh yêu cầu 25/08/2026: con số trên thanh menu cũng phải theo kỳ thống kê như thẻ số và
// danh sách. Trước đây badge đếm toàn bộ, nên menu nói 46.660 trong khi trang danh sách
// (đã theo kỳ) nói vài trăm — hai con số cho cùng một thứ.
describe('DashboardService — badge theo kỳ thống kê', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
    mockPrisma.case.count.mockResolvedValue(0);
    mockPrisma.incident.count.mockResolvedValue(0);
    mockPrisma.petition.count.mockResolvedValue(0);
    mockPrisma.subject.count.mockResolvedValue(0);
  });

  it('đếm trong khoảng của kỳ, theo NGÀY TIẾP NHẬN', async () => {
    mockSettings.getKyThongKe.mockResolvedValue({
      ky: KY_THONG_KE.THANG_HIEN_TAI,
      truong: TRUONG_NGAY_THONG_KE.NGAY_TIEP_NHAN,
      tuNgay: '2026-08-01',
      denNgay: '2026-08-31',
    });

    await service.getBadgeCounts();

    const wherePetition = mockPrisma.petition.count.mock.calls[0][0].where;
    expect(wherePetition.receivedDate).toEqual({
      gte: new Date('2026-08-01'),
      lte: new Date('2026-08-31'),
    });

    const whereIncident = mockPrisma.incident.count.mock.calls[0][0].where;
    expect(whereIncident.ngayDeXuat).toBeDefined();
  });

  it('chọn NGÀY TẠO thì lọc theo createdAt, KHÔNG theo cột tiếp nhận', async () => {
    mockSettings.getKyThongKe.mockResolvedValue({
      ky: KY_THONG_KE.NAM_HIEN_TAI,
      truong: TRUONG_NGAY_THONG_KE.NGAY_TAO,
      tuNgay: '2026-01-01',
      denNgay: '2026-12-31',
    });

    await service.getBadgeCounts();

    const wherePetition = mockPrisma.petition.count.mock.calls[0][0].where;
    expect(wherePetition.createdAt).toBeDefined();
    expect(wherePetition.receivedDate).toBeUndefined();
  });

  /**
   * TAT_CA phải đếm TOÀN BỘ, không được lặng lẽ thành một khoảng.
   *
   * `tuNgay`/`denNgay` là `null`; nếu tầng này dựng `{ gte: new Date(null) }` thì ra
   * `Invalid Date` và mọi badge về 0 mà không lỗi nào được ném.
   */
  it('kỳ TAT_CA → không thêm điều kiện ngày nào', async () => {
    mockSettings.getKyThongKe.mockResolvedValue({
      ky: KY_THONG_KE.TAT_CA,
      truong: TRUONG_NGAY_THONG_KE.NGAY_TIEP_NHAN,
      tuNgay: null,
      denNgay: null,
    });

    await service.getBadgeCounts();

    const wherePetition = mockPrisma.petition.count.mock.calls[0][0].where;
    expect(wherePetition.receivedDate).toBeUndefined();
    expect(wherePetition.createdAt).toBeUndefined();
  });

  /**
   * GIỮ NGUYÊN NGỮ NGHĨA CŨ của badge — ghi rõ để lần sau không ai "dọn cho đồng nhất".
   * Vụ án đếm REGULAR (loại trừ uỷ thác); vụ việc và đơn thư đếm hồ sơ CHƯA GIẢI QUYẾT.
   */
  it('giữ nguyên ngữ nghĩa: vụ án REGULAR, vụ việc/đơn thư chưa giải quyết', async () => {
    await service.getBadgeCounts();

    expect(mockPrisma.case.count.mock.calls[0][0].where.caseType).toBe('REGULAR');
    expect(mockPrisma.petition.count.mock.calls[0][0].where.status.notIn).toBeDefined();
    expect(mockPrisma.incident.count.mock.calls[0][0].where.status.notIn).toBeDefined();
  });
});
