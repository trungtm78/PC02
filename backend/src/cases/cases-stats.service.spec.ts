/**
 * Cases stats endpoint tests (PR1/T15).
 *
 * GET /api/v1/cases/stats — server-aggregated count by status, scoped to
 * active non-status filters. Used by <ListPageShell.StatusChips countsSource>.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { CaseStatus, CaseType } from '@prisma/client';

const mockPrisma = {
  case: {
    groupBy: jest.fn(),
    count: jest.fn(),
  },
};

describe('CasesService.getStats — status count aggregation (T15)', () => {
  let service: CasesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: SettingsService, useValue: { getValue: jest.fn().mockResolvedValue(null) } },
        {
          provide: DocumentNumbersService,
          useValue: { generate: jest.fn(), commitWithTx: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(CasesService);
  });

  it('trả về object với key=CaseStatus + total', async () => {
    mockPrisma.case.groupBy.mockResolvedValue([
      { status: CaseStatus.TIEP_NHAN, _count: { _all: 12 } },
      { status: CaseStatus.DANG_DIEU_TRA, _count: { _all: 45 } },
      { status: CaseStatus.DA_KET_LUAN, _count: { _all: 7 } },
    ]);
    mockPrisma.case.count.mockResolvedValue(64);

    const result = await service.getStats({}, null);

    expect(result.total).toBe(64);
    expect(result.byStatus.TIEP_NHAN).toBe(12);
    expect(result.byStatus.DANG_DIEU_TRA).toBe(45);
    expect(result.byStatus.DA_KET_LUAN).toBe(7);
  });

  it('exhaustive: mọi CaseStatus đều có entry (zero nếu không có rows)', async () => {
    mockPrisma.case.groupBy.mockResolvedValue([
      { status: CaseStatus.TIEP_NHAN, _count: { _all: 5 } },
    ]);
    mockPrisma.case.count.mockResolvedValue(5);

    const result = await service.getStats({}, null);

    Object.values(CaseStatus).forEach((status) => {
      expect(result.byStatus[status]).toBeDefined();
      expect(typeof result.byStatus[status]).toBe('number');
    });
    expect(result.byStatus.TIEP_NHAN).toBe(5);
    expect(result.byStatus.DA_LUU_TRU).toBe(0);
  });

  it('exclude status filter khỏi where → counts reflect "all statuses scoped to non-status filters"', async () => {
    mockPrisma.case.groupBy.mockResolvedValue([
      { status: CaseStatus.TIEP_NHAN, _count: { _all: 3 } },
    ]);
    mockPrisma.case.count.mockResolvedValue(3);

    await service.getStats(
      { status: CaseStatus.DANG_DIEU_TRA, investigatorId: 'inv-1' },
      null,
    );

    // status sẽ bị strip khỏi where vì stats endpoint count theo status
    const whereArg = mockPrisma.case.groupBy.mock.calls[0][0].where;
    expect(whereArg.status).toBeUndefined();
    expect(whereArg.investigatorId).toBe('inv-1');
  });

  it('default REGULAR caseType filter (consistent với getList)', async () => {
    mockPrisma.case.groupBy.mockResolvedValue([]);
    mockPrisma.case.count.mockResolvedValue(0);

    await service.getStats({}, null);

    const whereArg = mockPrisma.case.groupBy.mock.calls[0][0].where;
    expect(whereArg.caseType).toBe(CaseType.REGULAR);
  });

  it('UTDT caseType filter pass through', async () => {
    mockPrisma.case.groupBy.mockResolvedValue([]);
    mockPrisma.case.count.mockResolvedValue(0);

    await service.getStats({ caseType: CaseType.UY_THAC_DIEU_TRA }, null);

    const whereArg = mockPrisma.case.groupBy.mock.calls[0][0].where;
    expect(whereArg.caseType).toBe(CaseType.UY_THAC_DIEU_TRA);
  });

  it('exclude soft-deleted records (deletedAt: null)', async () => {
    mockPrisma.case.groupBy.mockResolvedValue([]);
    mockPrisma.case.count.mockResolvedValue(0);

    await service.getStats({}, null);

    const whereArg = mockPrisma.case.groupBy.mock.calls[0][0].where;
    expect(whereArg.deletedAt).toBeNull();
  });

  it('overdue filter pass through (consistent với getList)', async () => {
    mockPrisma.case.groupBy.mockResolvedValue([]);
    mockPrisma.case.count.mockResolvedValue(0);

    await service.getStats({ overdue: true }, null);

    const whereArg = mockPrisma.case.groupBy.mock.calls[0][0].where;
    // overdue → deadline < now (deadline filter set)
    expect(whereArg.deadline).toBeDefined();
  });

  it('search filter pass through', async () => {
    mockPrisma.case.groupBy.mockResolvedValue([]);
    mockPrisma.case.count.mockResolvedValue(0);

    await service.getStats({ search: 'abc' }, null);

    const whereArg = mockPrisma.case.groupBy.mock.calls[0][0].where;
    expect(whereArg.OR).toBeDefined();
    expect(Array.isArray(whereArg.OR)).toBe(true);
  });
});
