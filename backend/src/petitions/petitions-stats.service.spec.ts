/**
 * Petitions stats endpoint tests (PR2/T2).
 *
 * GET /api/v1/petitions/stats — server-aggregated count by PetitionStatus,
 * scoped to active non-status filters. Mirrors PR1 Cases + PR2/T1 Incidents
 * stats pattern: exhaustive byStatus + total derived from groupResults
 * (snapshot consistent).
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PetitionsService } from './petitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { PetitionStatus } from '@prisma/client';

const mockPrisma = {
  petition: {
    groupBy: jest.fn(),
  },
};

describe('PetitionsService.getStats — status count aggregation (PR2/T2)', () => {
  let service: PetitionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetitionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: SettingsService, useValue: { getValue: jest.fn().mockResolvedValue(null) } },
        {
          provide: DeadlineRulesService,
          useValue: { getActiveByKey: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: DocumentNumbersService,
          useValue: { generate: jest.fn(), commitWithTx: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(PetitionsService);
  });

  it('returns { total, byStatus } with exhaustive PetitionStatus keys', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([
      { status: PetitionStatus.MOI_TIEP_NHAN, _count: { _all: 8 } },
      { status: PetitionStatus.DANG_XU_LY, _count: { _all: 15 } },
      { status: PetitionStatus.DA_GIAI_QUYET, _count: { _all: 4 } },
    ]);

    const result = await service.getStats({}, null);

    expect(result.total).toBe(27);
    expect(result.byStatus.MOI_TIEP_NHAN).toBe(8);
    expect(result.byStatus.DANG_XU_LY).toBe(15);
    expect(result.byStatus.DA_GIAI_QUYET).toBe(4);
    // Exhaustive: every PetitionStatus key present
    Object.values(PetitionStatus).forEach((status) => {
      expect(result.byStatus[status]).toBeDefined();
      expect(typeof result.byStatus[status]).toBe('number');
    });
    expect(result.byStatus.DA_CHUYEN_VU_VIEC).toBe(0);
  });

  it('total derived from groupResults (snapshot consistent — PR1 codex P2 fix pattern)', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([
      { status: PetitionStatus.MOI_TIEP_NHAN, _count: { _all: 11 } },
      { status: PetitionStatus.DANG_XU_LY, _count: { _all: 6 } },
    ]);

    const result = await service.getStats({}, null);

    expect(result.total).toBe(17); // 11 + 6
    expect((mockPrisma.petition as any).count).toBeUndefined();
  });

  it('exclude soft-deleted records (deletedAt: null)', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([]);
    await service.getStats({}, null);
    const whereArg = mockPrisma.petition.groupBy.mock.calls[0][0].where;
    expect(whereArg.deletedAt).toBeNull();
  });

  it('search filter pass-through', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([]);
    await service.getStats({ search: 'xyz' }, null);
    const whereArg = mockPrisma.petition.groupBy.mock.calls[0][0].where;
    expect(whereArg.OR).toBeDefined();
    expect(Array.isArray(whereArg.OR)).toBe(true);
  });

  it('senderName filter pass-through', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([]);
    await service.getStats({ senderName: 'Nguyen' }, null);
    const whereArg = mockPrisma.petition.groupBy.mock.calls[0][0].where;
    expect(whereArg.senderName).toEqual({ contains: 'Nguyen', mode: 'insensitive' });
  });

  it('overdue filter pass-through', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([]);
    await service.getStats({ overdue: true }, null);
    const whereArg = mockPrisma.petition.groupBy.mock.calls[0][0].where;
    expect(whereArg.deadline).toBeDefined();
    // status excluded từ overdue filter (terminal statuses excluded)
    expect(whereArg.status).toBeDefined();
  });

  it('applies DataScope filter to where.AND when dataScope non-null (CLAUDE.md invariant)', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([]);
    await service.getStats(
      {},
      { userIds: ['user-001'], teamIds: ['team-a'], writableTeamIds: [] },
    );
    const whereArg = mockPrisma.petition.groupBy.mock.calls[0][0].where;
    expect(whereArg.AND).toBeDefined();
    expect(Array.isArray(whereArg.AND)).toBe(true);
    expect(whereArg.AND.length).toBeGreaterThan(0);
  });

  it('zero results — empty groupBy returns all keys = 0', async () => {
    mockPrisma.petition.groupBy.mockResolvedValue([]);
    const result = await service.getStats({}, null);
    expect(result.total).toBe(0);
    Object.values(PetitionStatus).forEach((status) => {
      expect(result.byStatus[status]).toBe(0);
    });
  });
});
