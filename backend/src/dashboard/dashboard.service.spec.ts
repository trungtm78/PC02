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
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
    mockPrisma.case.count.mockResolvedValue(0);
    mockPrisma.incident.count.mockResolvedValue(0);
    mockPrisma.petition.count.mockResolvedValue(0);
    mockPrisma.subject.count.mockResolvedValue(0);
    mockPrisma.case.groupBy.mockResolvedValue([]);
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
