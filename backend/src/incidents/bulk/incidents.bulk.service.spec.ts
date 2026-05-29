import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IncidentsBulkService } from './incidents.bulk.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { DataScope } from '../../auth/services/unit-scope.service';

/**
 * B4 — IncidentsBulkService tests (bulkAssign + bulkExport).
 * Mirror Cases B3 pattern: pre-validate ONCE, runBulk per-item tx, audit inside tx,
 * scope filter via preflight, optimistic lock optional.
 */
describe('IncidentsBulkService.bulkAssign — v0.48 B4', () => {
  let service: IncidentsBulkService;
  let mockPrisma: any;
  let mockAudit: any;

  const adminScope: DataScope = {
    userIds: [],
    teamIds: [],
    writableTeamIds: [],
    canDispatch: true,
    isWardOfficer: false,
  } as DataScope;

  const baseInput = {
    ids: ['inc-1', 'inc-2', 'inc-3'],
    investigatorId: 'inv-1',
    actorId: 'user-actor',
    dataScope: adminScope,
    reason: 'phân công đợt mới',
  };

  beforeEach(async () => {
    mockPrisma = {
      userTeam: {
        findFirst: jest.fn().mockResolvedValue({ userId: 'inv-1', teamId: 'team-A' }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', isActive: true }),
      },
      incident: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'inc-1', status: 'TIEP_NHAN' },
          { id: 'inc-2', status: 'DANG_XAC_MINH' },
          { id: 'inc-3', status: 'TIEP_NHAN' },
        ]),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) => {
        const tx = {
          incident: {
            update: jest.fn().mockResolvedValue({ id: 'mocked' }),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
        };
        return cb(tx);
      }),
    };

    mockAudit = {
      logBulkHeader: jest.fn().mockResolvedValue({ bulkOperationId: 'bulk-inc-1' }),
      logBulkItem: jest.fn().mockResolvedValue(undefined),
      completeBulk: jest.fn().mockResolvedValue(undefined),
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsBulkService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<IncidentsBulkService>(IncidentsBulkService);
  });

  it('happy path: assigns 3 incidents, returns 3 succeeded', async () => {
    const result = await service.bulkAssign(baseInput);

    expect(result.succeeded).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(mockAudit.logBulkHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'Incident',
        action: 'BULK_ASSIGN',
      }),
    );
    expect(mockAudit.completeBulk).toHaveBeenCalledWith(
      'bulk-inc-1',
      expect.objectContaining({ succeeded: 3 }),
    );
  });

  it('rejects with 400 khi investigator không active hoặc không tồn tại', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(service.bulkAssign(baseInput)).rejects.toThrow(BadRequestException);
    expect(mockAudit.logBulkHeader).not.toHaveBeenCalled();
  });

  it('skips out-of-scope incidents as PERMISSION via preflight', async () => {
    mockPrisma.incident.findMany.mockResolvedValue([
      { id: 'inc-1', status: 'TIEP_NHAN' },
      { id: 'inc-2', status: 'DANG_XAC_MINH' },
    ]);

    const result = await service.bulkAssign(baseInput);
    expect(result.succeeded.map((s) => s.id)).toEqual(['inc-1', 'inc-2']);
    expect(result.skipped).toEqual([{ id: 'inc-3', reason: 'PERMISSION' }]);
  });

  it('all out of scope → 0 succeeded but completeBulk still called', async () => {
    mockPrisma.incident.findMany.mockResolvedValue([]);

    const result = await service.bulkAssign(baseInput);
    expect(result.succeeded).toHaveLength(0);
    expect(result.skipped).toHaveLength(3);
    expect(mockAudit.completeBulk).toHaveBeenCalledWith(
      'bulk-inc-1',
      expect.objectContaining({ succeeded: 0, skipped: 3 }),
    );
  });

  it('skips incidents có terminal status (đã kết thúc) khỏi bulk-assign — Codex post-deploy P2 fix', async () => {
    // Preflight phase phải bao gồm filter terminal-status. inc-2 status DA_GIAI_QUYET → skip INELIGIBLE.
    // Mock case findMany trả về metadata status để preflight phân loại.
    mockPrisma.incident.findMany.mockResolvedValue([
      { id: 'inc-1', status: 'TIEP_NHAN' },
      { id: 'inc-2', status: 'DA_GIAI_QUYET' }, // terminal — must skip
      { id: 'inc-3', status: 'DANG_XAC_MINH' },
    ]);

    const result = await service.bulkAssign(baseInput);

    expect(result.succeeded.map((s) => s.id)).toEqual(['inc-1', 'inc-3']);
    expect(result.skipped).toContainEqual(
      expect.objectContaining({
        id: 'inc-2',
        reason: 'INELIGIBLE',
        message: expect.stringContaining('đã kết thúc'),
      }),
    );
  });

  it('transitions status to DANG_XAC_MINH when investigator được assign — match single-assign invariant', async () => {
    // Capture data passed to tx.incident.update.
    const updateCalls: any[] = [];
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        incident: {
          update: jest.fn().mockImplementation((args: any) => {
            updateCalls.push(args);
            return Promise.resolve({ id: args.where.id });
          }),
        },
        $executeRaw: jest.fn().mockResolvedValue(1),
      };
      return cb(tx);
    });

    await service.bulkAssign(baseInput);

    // Mỗi update phải include status = 'DANG_XAC_MINH' khi có investigatorId.
    expect(updateCalls.length).toBeGreaterThan(0);
    for (const call of updateCalls) {
      expect(call.data.status).toBe('DANG_XAC_MINH');
    }
  });

  it('KHÔNG transition status khi chỉ assign team (no investigatorId)', async () => {
    const updateCalls: any[] = [];
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        incident: {
          update: jest.fn().mockImplementation((args: any) => {
            updateCalls.push(args);
            return Promise.resolve({ id: args.where.id });
          }),
        },
        $executeRaw: jest.fn().mockResolvedValue(1),
      };
      return cb(tx);
    });

    await service.bulkAssign({
      ...baseInput,
      investigatorId: undefined,
      assignedTeamId: 'team-A',
    });

    // Update KHÔNG có status field khi chỉ assign team.
    for (const call of updateCalls) {
      expect(call.data.status).toBeUndefined();
    }
  });

  it('audit item written INSIDE per-item tx (E-H3 atomicity)', async () => {
    await service.bulkAssign(baseInput);
    expect(mockAudit.logBulkItem).toHaveBeenCalledTimes(3);
    for (const call of mockAudit.logBulkItem.mock.calls) {
      expect(call[1]).toBeDefined(); // tx param passed
    }
  });
});

describe('IncidentsBulkService.bulkExport — v0.48 B4', () => {
  let service: IncidentsBulkService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockRes: any;

  const adminScope: DataScope = {
    userIds: [],
    teamIds: [],
    writableTeamIds: [],
    canDispatch: true,
    isWardOfficer: false,
  } as DataScope;

  beforeEach(async () => {
    mockPrisma = {
      incident: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inc-1',
            incidentCode: 'IN-2026-001',
            name: 'Vụ việc 1',
            crime: 'Cố ý gây thương tích',
            unit: 'P. Bến Nghé',
            createdAt: new Date('2026-01-15'),
            status: 'TIEP_NHAN',
            investigator: { firstName: 'A', lastName: 'Nguyễn' },
          },
        ]),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
      logBulkHeader: jest.fn(),
      logBulkItem: jest.fn(),
      completeBulk: jest.fn(),
    };
    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      destroy: jest.fn(),
      headersSent: false,
      write: jest.fn((_chunk: any, cb?: any) => {
        if (cb) cb();
        return true;
      }),
      end: jest.fn((cb?: any) => {
        if (cb) cb();
      }),
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsBulkService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<IncidentsBulkService>(IncidentsBulkService);
  });

  it('queries incident.findMany với id IN + scope filter', async () => {
    await service.bulkExport({
      ids: ['inc-1', 'inc-2'],
      dataScope: adminScope,
      res: mockRes as any,
      actorId: 'user-1',
    });
    expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['inc-1', 'inc-2'] },
          deletedAt: null,
        }),
      }),
    );
  });

  it('writes xlsx headers + audit INCIDENT_BULK_EXPORTED', async () => {
    await service.bulkExport({
      ids: ['inc-1'],
      dataScope: adminScope,
      res: mockRes as any,
      actorId: 'user-1',
    });
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INCIDENT_BULK_EXPORTED',
        subject: 'Incident',
      }),
    );
  });

  it('rejects empty ids and > 1000 ids', async () => {
    await expect(
      service.bulkExport({
        ids: [],
        dataScope: adminScope,
        res: mockRes as any,
        actorId: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.bulkExport({
        ids: Array.from({ length: 1001 }, (_, i) => `inc-${i}`),
        dataScope: adminScope,
        res: mockRes as any,
        actorId: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

// v0.50 PR3 — Incidents bulk-delete + bulk-restore
describe('IncidentsBulkService.bulkDelete — v0.50 PR3', () => {
  let service: IncidentsBulkService;
  let mockPrisma: any;
  let mockAudit: any;

  const adminScope: DataScope = {
    userIds: [],
    teamIds: [],
    writableTeamIds: [],
    canDispatch: true,
    isWardOfficer: false,
  } as DataScope;

  const eligibleInc = (id: string) => ({
    id,
    status: 'TIEP_NHAN',
    petitions: [],
    documents: [],
    name: `VV ${id}`,
    code: `IN-${id}`,
  });

  beforeEach(async () => {
    mockPrisma = {
      incident: {
        findMany: jest
          .fn()
          .mockResolvedValue([eligibleInc('inc-1'), eligibleInc('inc-2')]),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (cb: any) =>
        cb({
          incident: { update: jest.fn().mockResolvedValue({ id: 'mocked' }) },
          $executeRaw: jest.fn().mockResolvedValue(1),
        }),
      ),
    };
    mockAudit = {
      logBulkHeader: jest.fn().mockResolvedValue({ bulkOperationId: 'b-inc-del-1' }),
      logBulkItem: jest.fn().mockResolvedValue(undefined),
      completeBulk: jest.fn().mockResolvedValue(undefined),
      log: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsBulkService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<IncidentsBulkService>(IncidentsBulkService);
  });

  const baseInput = {
    ids: ['inc-1', 'inc-2'],
    reason: 'gỡ trùng lặp',
    actorId: 'actor-1',
    dataScope: adminScope,
  };

  it('happy path: deletes 2 eligible incidents với BULK_DELETE header', async () => {
    const result = await service.bulkDelete(baseInput);
    expect(result.succeeded).toHaveLength(2);
    expect(mockAudit.logBulkHeader).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'Incident', action: 'BULK_DELETE' }),
    );
  });

  it('skips status ≠ TIEP_NHAN với INELIGIBLE (match previewDelete invariant)', async () => {
    const inProg = eligibleInc('inc-2');
    inProg.status = 'DANG_XAC_MINH';
    mockPrisma.incident.findMany.mockResolvedValue([eligibleInc('inc-1'), inProg]);

    const result = await service.bulkDelete(baseInput);
    expect(result.succeeded.map((s) => s.id)).toEqual(['inc-1']);
    expect(result.skipped).toContainEqual(
      expect.objectContaining({
        id: 'inc-2',
        reason: 'INELIGIBLE',
        message: expect.stringContaining('Tiếp nhận'),
      }),
    );
  });

  it('skips incidents có linked petitions với INELIGIBLE', async () => {
    const withPetition = eligibleInc('inc-1');
    withPetition.petitions = [{ id: 'p-1' }] as any;
    mockPrisma.incident.findMany.mockResolvedValue([withPetition]);

    const result = await service.bulkDelete({ ...baseInput, ids: ['inc-1'] });
    expect(result.skipped[0]).toEqual(
      expect.objectContaining({
        id: 'inc-1',
        reason: 'INELIGIBLE',
        message: expect.stringContaining('đơn thư'),
      }),
    );
  });

  it('rejects empty + > 100 ids', async () => {
    await expect(service.bulkDelete({ ...baseInput, ids: [] })).rejects.toThrow(BadRequestException);
    await expect(
      service.bulkDelete({
        ...baseInput,
        ids: Array.from({ length: 101 }, (_, i) => `i-${i}`),
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('IncidentsBulkService.bulkRestore — v0.50 PR3', () => {
  let service: IncidentsBulkService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(async () => {
    mockPrisma = {
      incident: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'inc-1', deletedAt: new Date(Date.now() - 60_000), name: 'V1', code: 'I1' },
          { id: 'inc-2', deletedAt: new Date(Date.now() - 60_000), name: 'V2', code: 'I2' },
        ]),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (cb: any) =>
        cb({
          incident: { update: jest.fn().mockResolvedValue({ id: 'mocked' }) },
          $executeRaw: jest.fn().mockResolvedValue(1),
        }),
      ),
    };
    mockAudit = {
      logBulkHeader: jest.fn().mockResolvedValue({ bulkOperationId: 'b-inc-r-1' }),
      logBulkItem: jest.fn().mockResolvedValue(undefined),
      completeBulk: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsBulkService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<IncidentsBulkService>(IncidentsBulkService);
  });

  it('admin restores 2 soft-deleted incidents với BULK_RESTORE', async () => {
    const result = await service.bulkRestore({
      ids: ['inc-1', 'inc-2'],
      reason: 'khôi phục theo công văn',
      actorId: 'admin-1',
    });
    expect(result.succeeded).toHaveLength(2);
    expect(mockAudit.logBulkHeader).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'Incident', action: 'BULK_RESTORE' }),
    );
  });

  it('skips incidents không bị xóa với NOT_FOUND', async () => {
    mockPrisma.incident.findMany.mockResolvedValue([
      { id: 'inc-1', deletedAt: new Date(), name: 'OK', code: 'I1' },
    ]);
    const result = await service.bulkRestore({
      ids: ['inc-1', 'inc-2'],
      reason: 'khôi phục',
      actorId: 'admin-1',
    });
    expect(result.skipped).toContainEqual(
      expect.objectContaining({ id: 'inc-2', reason: 'NOT_FOUND' }),
    );
  });
});
