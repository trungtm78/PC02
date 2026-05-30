/**
 * Incidents stats endpoint tests (PR2/T1).
 *
 * GET /api/v1/incidents/stats — server-aggregated count by IncidentStatus,
 * scoped to active non-status filters. Mirrors PR1 Cases stats pattern:
 * exhaustive byStatus + total derived from groupResults (snapshot consistent).
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { IncidentStatus } from '@prisma/client';

const mockPrisma = {
  incident: {
    groupBy: jest.fn(),
  },
};

describe('IncidentsService.getStats — status count aggregation (PR2/T1)', () => {
  let service: IncidentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
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
    service = module.get(IncidentsService);
  });

  it('returns { total, byStatus } with exhaustive IncidentStatus keys', async () => {
    mockPrisma.incident.groupBy.mockResolvedValue([
      { status: IncidentStatus.TIEP_NHAN, _count: { _all: 5 } },
      { status: IncidentStatus.DANG_XAC_MINH, _count: { _all: 12 } },
      { status: IncidentStatus.DA_GIAI_QUYET, _count: { _all: 3 } },
    ]);

    const result = await service.getStats({}, null);

    expect(result.total).toBe(20);
    expect(result.byStatus.TIEP_NHAN).toBe(5);
    expect(result.byStatus.DANG_XAC_MINH).toBe(12);
    expect(result.byStatus.DA_GIAI_QUYET).toBe(3);
    // Exhaustive: mọi IncidentStatus đều có entry
    Object.values(IncidentStatus).forEach((status) => {
      expect(result.byStatus[status]).toBeDefined();
      expect(typeof result.byStatus[status]).toBe('number');
    });
    expect(result.byStatus.KHONG_KHOI_TO).toBe(0);
  });

  it('total derived from groupResults (snapshot consistent — PR1 codex P2 fix pattern)', async () => {
    mockPrisma.incident.groupBy.mockResolvedValue([
      { status: IncidentStatus.TIEP_NHAN, _count: { _all: 7 } },
      { status: IncidentStatus.QUA_HAN, _count: { _all: 2 } },
    ]);

    const result = await service.getStats({}, null);

    expect(result.total).toBe(9); // 7 + 2
    // Mock prisma.incident.count NOT called (single statement)
    expect((mockPrisma.incident as any).count).toBeUndefined();
  });

  it('exclude soft-deleted records (deletedAt: null)', async () => {
    mockPrisma.incident.groupBy.mockResolvedValue([]);
    await service.getStats({}, null);
    const whereArg = mockPrisma.incident.groupBy.mock.calls[0][0].where;
    expect(whereArg.deletedAt).toBeNull();
  });

  it('search filter pass-through', async () => {
    mockPrisma.incident.groupBy.mockResolvedValue([]);
    await service.getStats({ search: 'abc' }, null);
    const whereArg = mockPrisma.incident.groupBy.mock.calls[0][0].where;
    expect(whereArg.OR).toBeDefined();
    expect(Array.isArray(whereArg.OR)).toBe(true);
  });

  it('investigatorId filter pass-through', async () => {
    mockPrisma.incident.groupBy.mockResolvedValue([]);
    await service.getStats({ investigatorId: 'inv-1' }, null);
    const whereArg = mockPrisma.incident.groupBy.mock.calls[0][0].where;
    expect(whereArg.investigatorId).toBe('inv-1');
  });

  it('overdue filter pass-through', async () => {
    mockPrisma.incident.groupBy.mockResolvedValue([]);
    await service.getStats({ overdue: true }, null);
    const whereArg = mockPrisma.incident.groupBy.mock.calls[0][0].where;
    expect(whereArg.deadline).toBeDefined();
  });

  it('zero results — empty groupBy returns all keys = 0', async () => {
    mockPrisma.incident.groupBy.mockResolvedValue([]);
    const result = await service.getStats({}, null);
    expect(result.total).toBe(0);
    Object.values(IncidentStatus).forEach((status) => {
      expect(result.byStatus[status]).toBe(0);
    });
  });
});
