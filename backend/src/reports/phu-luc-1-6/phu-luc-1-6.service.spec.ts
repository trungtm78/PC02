/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * PhuLuc16Service Unit Tests
 *
 * 1. getForLoai(1) calls the correct Prisma method for incidents
 * 2. getForLoai(4) includes subjects and actionPlans
 * 3. Invalid loai returns empty data gracefully
 * 4. fromDate > toDate still executes (validation is at controller layer)
 * 5. Limit 500 is applied
 * 6. PL4 maps multi-subject case to multiple rows (via service data shape)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PhuLuc16Service } from './phu-luc-1-6.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  incident: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  case: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
};

// ─── Factories ────────────────────────────────────────────────────────────────

function makeIncident(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inc-001',
    code: 'VV-2026-00001',
    name: 'Vụ việc test',
    status: 'TIEP_NHAN',
    doiTuongCaNhan: 'Nguyễn Văn X',
    diaChiXayRa: 'Quận 1',
    incidentType: 'Trộm cắp',
    createdAt: new Date('2026-01-15'),
    deletedAt: null,
    actionPlans: [],
    ...overrides,
  };
}

function makeCase(overrides: Record<string, unknown> = {}, subjects: any[] = []) {
  return {
    id: 'case-abcdef12',
    name: 'Vụ án test',
    status: 'DANG_DIEU_TRA',
    crime: 'Cướp có vũ trang',
    unit: 'Đội 1',
    createdAt: new Date('2026-02-01'),
    deadline: new Date('2026-08-01'),
    deletedAt: null,
    subjects,
    actionPlans: [],
    ...overrides,
  };
}

function makeSubject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'subj-001',
    fullName: 'Trần Văn Y',
    dateOfBirth: new Date('1990-05-10'),
    address: '123 Nguyễn Trãi, Quận 5',
    crimeId: 'crime-001',
    type: 'SUSPECT',
    deletedAt: null,
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('PhuLuc16Service', () => {
  let service: PhuLuc16Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhuLuc16Service,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PhuLuc16Service>(PhuLuc16Service);
    jest.clearAllMocks();
    // Reset default return values after clearAllMocks
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.incident.count.mockResolvedValue(0);
    mockPrisma.case.findMany.mockResolvedValue([]);
    mockPrisma.case.count.mockResolvedValue(0);
  });

  // ── Test 1: getForLoai(1) uses incident.findMany ───────────────────────────

  it('getForLoai(1) calls incident.findMany (not case.findMany)', async () => {
    mockPrisma.incident.findMany.mockResolvedValue([makeIncident()]);
    mockPrisma.incident.count.mockResolvedValue(1);

    const result = await service.getForLoai(1, { loai: 1 });

    expect(mockPrisma.incident.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.limited).toBe(false);
  });

  // ── Test 2: getForLoai(4) includes subjects and actionPlans ───────────────

  it('getForLoai(4) includes subjects (SUSPECT only) and actionPlans', async () => {
    mockPrisma.case.findMany.mockResolvedValue([
      makeCase({}, [makeSubject()]),
    ]);
    mockPrisma.case.count.mockResolvedValue(1);

    await service.getForLoai(4, { loai: 4 });

    expect(mockPrisma.case.findMany).toHaveBeenCalledTimes(1);
    const callArgs = mockPrisma.case.findMany.mock.calls[0][0];

    // Verify includes
    expect(callArgs.include).toBeDefined();
    expect(callArgs.include.subjects).toBeDefined();
    expect(callArgs.include.subjects.where).toMatchObject({
      deletedAt: null,
      type: 'SUSPECT',
    });
    expect(callArgs.include.actionPlans).toBe(true);
  });

  // ── Test 3: Invalid loai returns empty data gracefully ────────────────────

  it('getForLoai with invalid loai (e.g. 99) returns empty result without throwing', async () => {
    const result = await service.getForLoai(99, { loai: 99 });

    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.limited).toBe(false);
    // Should not have called Prisma at all
    expect(mockPrisma.incident.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
  });

  // ── Test 4: fromDate > toDate still executes (no service-level validation) ─

  it('fromDate > toDate still executes without throwing (controller validates)', async () => {
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.incident.count.mockResolvedValue(0);

    // fromDate after toDate — service should not throw, just pass dates to Prisma
    await expect(
      service.getForLoai(1, {
        loai: 1,
        fromDate: '2026-12-31',
        toDate: '2026-01-01',
      }),
    ).resolves.toBeDefined();

    expect(mockPrisma.incident.findMany).toHaveBeenCalledTimes(1);
  });

  // ── Test 5: Default limit of 500 is applied ───────────────────────────────

  it('applies default limit of 500 when no limit is specified', async () => {
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.incident.count.mockResolvedValue(0);

    await service.getForLoai(1, { loai: 1 });

    const callArgs = mockPrisma.incident.findMany.mock.calls[0][0];
    expect(callArgs.take).toBe(500);
  });

  it('respects custom limit when provided', async () => {
    mockPrisma.case.findMany.mockResolvedValue([]);
    mockPrisma.case.count.mockResolvedValue(0);

    await service.getForLoai(4, { loai: 4, limit: 100 });

    const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
    expect(callArgs.take).toBe(100);
  });

  // ── Test 6: PL4 data shape supports multi-subject expansion ───────────────
  // The service returns raw Prisma objects (with subjects[]).
  // The export service is responsible for expanding to one row per subject.
  // This test verifies that the service preserves the subjects array intact.

  it('getForLoai(4) preserves multi-subject data so export service can expand rows', async () => {
    const twoSubjectCase = makeCase({}, [
      makeSubject({ id: 'subj-A', fullName: 'Bị can A' }),
      makeSubject({ id: 'subj-B', fullName: 'Bị can B' }),
    ]);
    mockPrisma.case.findMany.mockResolvedValue([twoSubjectCase]);
    mockPrisma.case.count.mockResolvedValue(1);

    const result = await service.getForLoai(4, { loai: 4 });

    // Service returns 1 case record with 2 subjects — expansion is done in export
    expect(result.data).toHaveLength(1);
    expect(result.data[0].subjects).toHaveLength(2);
    expect(result.data[0].subjects[0].fullName).toBe('Bị can A');
    expect(result.data[0].subjects[1].fullName).toBe('Bị can B');
  });
});
