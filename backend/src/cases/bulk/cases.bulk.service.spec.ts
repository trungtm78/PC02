import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CasesBulkService } from './cases.bulk.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { DataScope } from '../../auth/services/unit-scope.service';

/**
 * B3a — CasesBulkService.bulkAssign tests.
 *
 * Pattern: mock PrismaService + AuditService + verify call chain.
 * Plan eng E-C1 (composition), E-C4 (DispatchGuard at controller, scope at service),
 * E-H2 (optimistic lock), E-H3 (audit-inside-tx), E-H4 (scope filter on ids).
 */
describe('CasesBulkService.bulkAssign — v0.48 B3a', () => {
  let service: CasesBulkService;
  let mockPrisma: any;
  let mockAudit: any;

  // Admin-equivalent scope: canDispatch=true → buildScopeFilter trả null (no filter).
  // Tests scope-skip behavior dùng mock case.findMany trả subset trực tiếp.
  const adminScope: DataScope = {
    userIds: [],
    teamIds: [],
    writableTeamIds: [],
    canDispatch: true,
    isWardOfficer: false,
  } as DataScope;

  const baseInput = {
    ids: ['case-1', 'case-2', 'case-3'],
    assignedTeamId: 'team-A',
    investigatorId: 'inv-1',
    actorId: 'user-actor',
    dataScope: adminScope,
    reason: 'phân công đợt mới',
  };

  beforeEach(async () => {
    // Default mocks: team exists, investigator on team, all cases in scope, all updates succeed.
    mockPrisma = {
      team: {
        findFirst: jest.fn().mockResolvedValue({ id: 'team-A', isActive: true }),
      },
      userTeam: {
        findFirst: jest.fn().mockResolvedValue({ userId: 'inv-1', teamId: 'team-A' }),
      },
      case: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'case-1' },
          { id: 'case-2' },
          { id: 'case-3' },
        ]),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) => {
        // Mock tx exposes case.update + $executeRaw cho audit.logBulkItem.
        const tx = {
          case: {
            update: jest.fn().mockResolvedValue({ id: 'mocked', assignedTeamId: 'team-A' }),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
        };
        return cb(tx);
      }),
    };

    mockAudit = {
      logBulkHeader: jest
        .fn()
        .mockResolvedValue({ bulkOperationId: 'bulk-op-xyz' }),
      logBulkItem: jest.fn().mockResolvedValue(undefined),
      completeBulk: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesBulkService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<CasesBulkService>(CasesBulkService);
  });

  it('happy path: assigns 3 cases, returns 3 succeeded, calls logBulkHeader + completeBulk', async () => {
    const result = await service.bulkAssign(baseInput);

    expect(result.succeeded).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);
    expect(result.failed).toHaveLength(0);

    expect(mockAudit.logBulkHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-actor',
        resource: 'Case',
        action: 'BULK_ASSIGN',
      }),
    );
    expect(mockAudit.completeBulk).toHaveBeenCalledWith(
      'bulk-op-xyz',
      expect.objectContaining({ succeeded: 3, skipped: 0, failed: 0 }),
    );
    // Per-item tx: $transaction called once per id.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('rejects with 400 BadRequest khi team không tồn tại (validate ONCE before loop)', async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);

    await expect(service.bulkAssign(baseInput)).rejects.toThrow(BadRequestException);
    // KHÔNG được tạo bulk_operations header nếu validation chung fail.
    expect(mockAudit.logBulkHeader).not.toHaveBeenCalled();
  });

  it('rejects với 400 khi investigator không thuộc team (validate ONCE)', async () => {
    mockPrisma.userTeam.findFirst.mockResolvedValue(null);

    await expect(service.bulkAssign(baseInput)).rejects.toThrow(BadRequestException);
    expect(mockAudit.logBulkHeader).not.toHaveBeenCalled();
  });

  it('skips out-of-scope ids as PERMISSION via preflight (plan eng E-H4)', async () => {
    // Scope filter trả về 2 trong 3 ids → case-3 silently skipped (no enumeration leak).
    mockPrisma.case.findMany.mockResolvedValue([
      { id: 'case-1' },
      { id: 'case-2' },
    ]);

    const result = await service.bulkAssign(baseInput);

    expect(result.succeeded.map((s) => s.id)).toEqual(['case-1', 'case-2']);
    expect(result.skipped).toEqual([
      { id: 'case-3', reason: 'PERMISSION' },
    ]);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('P2025 optimistic lock fail → item skipped CONCURRENT_MODIFICATION (plan eng E-H2)', async () => {
    // case-2 update throws P2025 → caught + classified as CONCURRENT_MODIFICATION, không fail batch.
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        case: {
          update: jest.fn().mockImplementation(({ where }: any) => {
            if (where.id === 'case-2') {
              const err: any = new Error('Record not found');
              err.code = 'P2025';
              throw err;
            }
            return Promise.resolve({ id: where.id });
          }),
        },
        $executeRaw: jest.fn().mockResolvedValue(1),
      };
      return cb(tx);
    });

    const result = await service.bulkAssign({
      ...baseInput,
      expectedUpdatedAtByCaseId: { 'case-2': new Date('2026-01-01') } as any,
    });

    expect(result.succeeded.map((s) => s.id)).toEqual(['case-1', 'case-3']);
    expect(result.skipped).toContainEqual(
      expect.objectContaining({ id: 'case-2', reason: 'CONCURRENT_MODIFICATION' }),
    );
  });

  it('all ids out of scope → 0 succeeded but still completeBulk with COMPLETED', async () => {
    mockPrisma.case.findMany.mockResolvedValue([]);

    const result = await service.bulkAssign(baseInput);

    expect(result.succeeded).toHaveLength(0);
    expect(result.skipped).toHaveLength(3);
    expect(result.skipped.every((s) => s.reason === 'PERMISSION')).toBe(true);
    expect(mockAudit.completeBulk).toHaveBeenCalledWith(
      'bulk-op-xyz',
      expect.objectContaining({ succeeded: 0, skipped: 3, failed: 0 }),
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('writes audit item INSIDE each per-item tx (plan eng E-H3 atomicity)', async () => {
    let txAuditCalls = 0;
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        case: { update: jest.fn().mockResolvedValue({ id: 'x' }) },
        $executeRaw: jest.fn().mockImplementation(() => {
          txAuditCalls++;
          return Promise.resolve(1);
        }),
      };
      const result = await cb(tx);
      return result;
    });

    await service.bulkAssign(baseInput);

    // Audit phải gọi VÀO tx (qua mockAudit.logBulkItem nhận tx).
    expect(mockAudit.logBulkItem).toHaveBeenCalledTimes(3);
    // Mỗi call phải có tx parameter (truyền vào để rollback đồng bộ).
    for (const call of mockAudit.logBulkItem.mock.calls) {
      expect(call[1]).toBeDefined(); // tx param
    }
  });

  it('passes idempotencyKey to logBulkHeader for retry safety (plan eng E-H10)', async () => {
    await service.bulkAssign({ ...baseInput, idempotencyKey: 'client-req-abc' });

    expect(mockAudit.logBulkHeader).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'client-req-abc' }),
    );
  });
});
