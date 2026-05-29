import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('log()', () => {
    it('writes audit row via $executeRaw', async () => {
      await service.log({ userId: 'u1', action: 'TEST_ACTION', metadata: { foo: 'bar' } });
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('accepts tx parameter', async () => {
      const mockTx = { $executeRaw: jest.fn().mockResolvedValue(1) };
      await service.log({ userId: 'u1', action: 'TEST_TX' }, mockTx as any);
      expect(mockTx.$executeRaw).toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('wrapUpdate() — v0.29 PII sanitize + tx support', () => {
    it('sanitizes PII fields (passwordHash, refreshTokenHash) before storing', async () => {
      await service.wrapUpdate({
        fetchFn: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'admin@pc02.local',
          passwordHash: '$2b$xxxxx',
          refreshTokenHash: 'old_token',
        }),
        updateFn: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'new@pc02.local',
          passwordHash: '$2b$yyyyy',
          refreshTokenHash: 'new_token',
        }),
        action: 'USER_UPDATED',
        subject: 'User',
        subjectId: 'u1',
        userId: 'admin',
      });

      const allArgs = JSON.stringify(mockPrisma.$executeRaw.mock.calls);
      expect(allArgs).not.toContain('passwordHash');
      expect(allArgs).not.toContain('refreshTokenHash');
      expect(allArgs).toContain('admin@pc02.local');
      expect(allArgs).toContain('new@pc02.local');
    });

    it('returns the after-value from updateFn', async () => {
      const after = { id: 'u1', email: 'new@pc02.local' };
      const result = await service.wrapUpdate({
        fetchFn: jest.fn().mockResolvedValue({ id: 'u1', email: 'old@pc02.local' }),
        updateFn: jest.fn().mockResolvedValue(after),
        action: 'USER_UPDATED',
        subject: 'User',
        subjectId: 'u1',
        userId: 'admin',
      });
      expect(result).toEqual(after);
    });

    it('passes tx to log() when provided', async () => {
      const mockTx = { $executeRaw: jest.fn().mockResolvedValue(1) };
      await service.wrapUpdate({
        fetchFn: jest.fn().mockResolvedValue({ id: 'u1' }),
        updateFn: jest.fn().mockResolvedValue({ id: 'u1' }),
        action: 'TEST',
        subject: 'User',
        subjectId: 'u1',
        userId: 'admin',
        tx: mockTx as any,
      });
      expect(mockTx.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('findAll() — v0.29 enhanced', () => {
    it('orderBy createdAt DESC (newest first, fix v0.28 bug)', async () => {
      await service.findAll({});
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('clamps limit to max 100', async () => {
      await service.findAll({ limit: 500 });
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('clamps limit to min 1 (input 0)', async () => {
      await service.findAll({ limit: 0 });
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });

    it('clamps offset to min 0', async () => {
      await service.findAll({ offset: -5 });
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });

    it('attaches changedFields[] from sanitized metadata.before/after', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'a1',
          action: 'USER_UPDATED',
          metadata: {
            before: { email: 'old@pc02.local' },
            after: { email: 'new@pc02.local' },
          },
        },
      ]);
      const result = await service.findAll({});
      expect((result.data[0] as any).changedFields).toHaveLength(1);
      expect((result.data[0] as any).changedFields[0].field).toBe('email');
    });

    it('filters by dateFrom and dateTo', async () => {
      const dateFrom = new Date('2026-05-01');
      const dateTo = new Date('2026-05-20');
      await service.findAll({ dateFrom, dateTo });
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: dateFrom, lte: dateTo },
          }),
        }),
      );
    });

    it('search returns no error and queries DB', async () => {
      await service.findAll({ search: 'admin' });
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalled();
    });

    it('search escapes % and _ to prevent intent bypass', async () => {
      // Implementation should escape these wildcards; verify by checking the where
      // clause stringifies with escaped versions (or doesn't include raw unescaped).
      await service.findAll({ search: '100%_test' });
      const callArg = JSON.stringify(mockPrisma.auditLog.findMany.mock.calls[0][0]);
      // After escape, raw '100%_test' should NOT appear (would appear as 100\%\_test)
      expect(callArg).not.toMatch(/"100%_test"/);
    });
  });

  // ───────────────────────────────────────────────
  // v0.48 PR1 B2 — bulk operations audit
  // 1 header row per bulk op (STARTED → COMPLETED/FAILED) + N item rows in audit_logs.
  // Plan eng E-H3: audit phải atomic với data write → logBulkItem accept tx.
  // ───────────────────────────────────────────────
  describe('logBulkHeader() — v0.48 B2', () => {
    it('inserts a bulk_operations row with status STARTED and returns the generated id', async () => {
      const result = await service.logBulkHeader({
        actorId: 'user-1',
        resource: 'Case',
        action: 'BULK_EXPORT',
      });
      expect(typeof result.bulkOperationId).toBe('string');
      expect(result.bulkOperationId.length).toBeGreaterThan(0);
      // INSERT phải qua $executeRaw để consistent với log() pattern.
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
      const sqlCall = JSON.stringify(mockPrisma.$executeRaw.mock.calls);
      expect(sqlCall).toContain('bulk_operations');
      expect(sqlCall).toContain('STARTED');
    });

    it('persists optional idempotencyKey for retry dedupe (plan eng E-H10)', async () => {
      await service.logBulkHeader({
        actorId: 'user-1',
        resource: 'Incident',
        action: 'BULK_ASSIGN',
        idempotencyKey: 'req-abc-123',
      });
      const sqlCall = JSON.stringify(mockPrisma.$executeRaw.mock.calls);
      expect(sqlCall).toContain('req-abc-123');
    });
  });

  describe('logBulkItem() — v0.48 B2', () => {
    it('writes audit_logs row with bulkOperationId set', async () => {
      await service.logBulkItem({
        bulkOperationId: 'bulk-op-1',
        userId: 'user-1',
        action: 'CASE_DELETED',
        subject: 'Case',
        subjectId: 'case-42',
      });
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
      const sqlCall = JSON.stringify(mockPrisma.$executeRaw.mock.calls);
      expect(sqlCall).toContain('bulk-op-1');
      expect(sqlCall).toContain('case-42');
    });

    it('accepts tx parameter to commit audit atomic với data write (plan eng E-H3)', async () => {
      const mockTx = { $executeRaw: jest.fn().mockResolvedValue(1) };
      await service.logBulkItem(
        {
          bulkOperationId: 'bulk-op-1',
          userId: 'user-1',
          action: 'CASE_DELETED',
          subject: 'Case',
          subjectId: 'case-42',
        },
        mockTx as any,
      );
      // Audit phải gọi vào tx, KHÔNG prisma chính, để rollback nếu data write fail.
      expect(mockTx.$executeRaw).toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('sanitizes metadata PII before persist (reuse log() pattern)', async () => {
      await service.logBulkItem({
        bulkOperationId: 'bulk-op-1',
        userId: 'user-1',
        action: 'USER_UPDATED',
        subject: 'User',
        subjectId: 'u-9',
        metadata: { email: 'e@x', passwordHash: '$2b$xxxxx' },
      });
      const sqlCall = JSON.stringify(mockPrisma.$executeRaw.mock.calls);
      expect(sqlCall).not.toContain('passwordHash');
      expect(sqlCall).toContain('e@x');
    });
  });

  describe('completeBulk() — v0.48 B2', () => {
    it('updates bulk_operations row with COMPLETED status + counts + completedAt', async () => {
      await service.completeBulk('bulk-op-1', {
        succeeded: 15,
        skipped: 5,
        failed: 2,
      });
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
      const sqlCall = JSON.stringify(mockPrisma.$executeRaw.mock.calls);
      expect(sqlCall).toContain('COMPLETED');
      expect(sqlCall).toContain('bulk-op-1');
      expect(sqlCall).toContain('15');
      expect(sqlCall).toContain('5');
      expect(sqlCall).toContain('2');
    });

    it('marks status FAILED if explicitly requested (op-level failure path)', async () => {
      await service.completeBulk('bulk-op-2', {
        succeeded: 0,
        skipped: 0,
        failed: 10,
        status: 'FAILED',
      });
      const sqlCall = JSON.stringify(mockPrisma.$executeRaw.mock.calls);
      expect(sqlCall).toContain('FAILED');
    });
  });
});
