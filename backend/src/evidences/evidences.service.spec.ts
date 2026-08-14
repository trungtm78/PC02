import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EvidencesService } from './evidences.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EVIDENCE_STATUS } from '../common/constants/evidence-status.constants';
import type { DataScope } from '../auth/services/unit-scope.service';

const mockPrisma = {
  evidence: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  case: {
    findFirst: jest.fn(),
  },
  $queryRaw: jest.fn(),
  // Writes run inside withCaseLock, which takes a row lock on the parent case
  // and hands the callback a transaction client. Running the callback against
  // the same mock keeps the assertions below pointed at one set of spies.
  $transaction: jest.fn((fn: unknown) =>
    typeof fn === 'function'
      ? (fn as (tx: typeof mockPrisma) => unknown)(mockPrisma)
      : undefined,
  ),
};

/** Re-arm $transaction after jest.clearAllMocks() drops the implementation. */
function armTransaction() {
  mockPrisma.$transaction.mockImplementation((fn: unknown) =>
    typeof fn === 'function'
      ? (fn as (tx: typeof mockPrisma) => unknown)(mockPrisma)
      : undefined,
  );
  mockPrisma.$queryRaw.mockResolvedValue([{ id: 'case-a' }]);
}

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

/**
 * First argument of a mock's first call, typed.
 *
 * Reading `mock.calls[0][0]` directly yields `any`, which turns every
 * subsequent assertion into an unchecked one and buries the spec in
 * no-unsafe-* errors.
 */
function firstArg<T>(mock: jest.Mock): T {
  return mock.mock.calls[0][0] as T;
}

type FindManyArgs = {
  where: Record<string, unknown> & { case?: unknown; OR?: unknown[] };
  take?: number;
  skip?: number;
};

/** A case belonging to team-A, investigated by inv-1. */
const CASE_A = {
  id: 'case-a',
  name: 'Vụ án A',
  caseCode: 'VA-2026-001',
  status: 'TIEP_NHAN',
  assignedTeamId: 'team-A',
  investigatorId: 'inv-1',
};

/** Scope of an officer who can only see team-B. */
const SCOPE_TEAM_B: DataScope = {
  teamIds: ['team-B'],
  userIds: ['inv-2'],
} as unknown as DataScope;

const SCOPE_TEAM_A: DataScope = {
  teamIds: ['team-A'],
  userIds: ['inv-1'],
} as unknown as DataScope;

describe('EvidencesService', () => {
  let service: EvidencesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidencesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(EvidencesService);
    jest.clearAllMocks();
    armTransaction();
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns the record when it exists', async () => {
      mockPrisma.evidence.findFirst.mockResolvedValue({
        id: 'ev-1',
        code: 'VC-001',
        case: CASE_A,
      });

      const result = await service.getById('ev-1');

      expect(result.data.code).toBe('VC-001');
    });

    it('throws NotFoundException for a missing or soft-deleted record', async () => {
      mockPrisma.evidence.findFirst.mockResolvedValue(null);

      await expect(service.getById('gone')).rejects.toThrow(NotFoundException);
      // The query itself must exclude soft-deleted rows.
      expect(mockPrisma.evidence.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('refuses to read evidence belonging to another team', async () => {
      mockPrisma.evidence.findFirst.mockResolvedValue({
        id: 'ev-1',
        case: CASE_A,
      });

      await expect(service.getById('ev-1', SCOPE_TEAM_B)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── getList ───────────────────────────────────────────────────────────────

  describe('getList', () => {
    beforeEach(() => {
      mockPrisma.evidence.findMany.mockResolvedValue([]);
      mockPrisma.evidence.count.mockResolvedValue(0);
    });

    it('never returns soft-deleted rows', async () => {
      await service.getList({});

      expect(mockPrisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('applies the data scope through the parent case', async () => {
      await service.getList({}, SCOPE_TEAM_A);

      const arg = firstArg<FindManyArgs>(mockPrisma.evidence.findMany);
      expect(arg.where.case).toBeDefined();
    });

    it('hides evidence whose parent case is soft-deleted', async () => {
      // Deleting a case used to leave its seized items listable, because the
      // scope filter was the only thing ever put on `case`.
      await service.getList({});

      const arg = firstArg<FindManyArgs>(mockPrisma.evidence.findMany);
      expect(arg.where.case).toEqual({ deletedAt: null });
    });

    it('keeps the deleted-case filter when a scope is also applied', async () => {
      await service.getList({}, SCOPE_TEAM_A);

      const arg = firstArg<FindManyArgs>(mockPrisma.evidence.findMany);
      expect(arg.where.case).toEqual({
        AND: [expect.anything(), { deletedAt: null }],
      });
    });

    it('searches across code, name, storage location and receipt number', async () => {
      await service.getList({ search: 'dao' });

      const arg = firstArg<FindManyArgs>(mockPrisma.evidence.findMany);
      expect(arg.where.OR).toHaveLength(4);
    });

    it('filters by case, status and type when asked', async () => {
      await service.getList({
        caseId: 'case-a',
        status: EVIDENCE_STATUS.DA_GIAM_DINH,
        evidenceType: 'vũ khí',
      });

      const arg = firstArg<FindManyArgs>(mockPrisma.evidence.findMany);
      expect(arg.where).toMatchObject({
        caseId: 'case-a',
        status: EVIDENCE_STATUS.DA_GIAM_DINH,
        evidenceType: 'vũ khí',
      });
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { code: 'VC-001', name: 'Dao', caseId: 'case-a' };

    it('creates with the default status and records an audit entry', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(CASE_A);
      mockPrisma.evidence.findFirst.mockResolvedValue(null);
      mockPrisma.evidence.create.mockResolvedValue({ id: 'ev-1', ...dto });

      await service.create(dto, 'actor-1', { ipAddress: '10.0.0.1' });

      expect(mockPrisma.evidence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EVIDENCE_STATUS.THU_GIU,
            quantity: 1,
            unit: 'cái',
            createdById: 'actor-1',
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EVIDENCE_CREATED',
          ipAddress: '10.0.0.1',
        }),
      );
    });

    it('serialises the duplicate check and the insert behind a row lock', async () => {
      // Two concurrent requests both read "no duplicate" and both inserted.
      // The lock on the parent case makes evidence writes for that case queue.
      mockPrisma.case.findFirst.mockResolvedValue(CASE_A);
      mockPrisma.evidence.findFirst.mockResolvedValue(null);
      mockPrisma.evidence.create.mockResolvedValue({ id: 'ev-1' });

      await service.create(dto, 'actor-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('rejects a case that does not exist', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(null);

      await expect(service.create(dto, 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.evidence.create).not.toHaveBeenCalled();
    });

    // The gap this module was written to avoid repeating: POST /subjects and
    // POST /lawyers accepted any caseId regardless of the caller's scope.
    it('refuses to attach evidence to another team’s case', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(CASE_A);

      await expect(
        service.create(dto, 'actor-1', undefined, SCOPE_TEAM_B),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.evidence.create).not.toHaveBeenCalled();
    });

    it('rejects a code already used within the same case', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(CASE_A);
      mockPrisma.evidence.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto, 'actor-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('allows the same code in a different case', async () => {
      mockPrisma.case.findFirst.mockResolvedValue({ ...CASE_A, id: 'case-b' });
      mockPrisma.evidence.findFirst.mockResolvedValue(null); // scoped by caseId
      mockPrisma.evidence.create.mockResolvedValue({ id: 'ev-2' });

      await service.create({ ...dto, caseId: 'case-b' }, 'actor-1');

      expect(mockPrisma.evidence.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ caseId: 'case-b', code: 'VC-001' }),
        }),
      );
      expect(mockPrisma.evidence.create).toHaveBeenCalled();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and audits the before/after values', async () => {
      // Only one findFirst here: the duplicate-code probe is guarded by
      // `dto.code`, which this update does not set.
      mockPrisma.evidence.findFirst.mockResolvedValue({
        id: 'ev-1',
        code: 'VC-001',
        name: 'Dao',
        status: EVIDENCE_STATUS.THU_GIU,
        quantity: 1,
        caseId: 'case-a',
        case: CASE_A,
      });
      mockPrisma.evidence.update.mockResolvedValue({ id: 'ev-1' });

      await service.update(
        'ev-1',
        { status: EVIDENCE_STATUS.DA_GIAM_DINH },
        'actor-1',
      );

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EVIDENCE_UPDATED',
          metadata: expect.objectContaining({
            before: expect.objectContaining({
              status: EVIDENCE_STATUS.THU_GIU,
            }),
          }),
        }),
      );
    });

    it('rejects renaming the code to one already used in the same case', async () => {
      mockPrisma.evidence.findFirst
        .mockResolvedValueOnce({
          id: 'ev-1',
          code: 'VC-001',
          caseId: 'case-a',
          case: CASE_A,
        })
        .mockResolvedValueOnce({ id: 'ev-other' }); // duplicate-code probe hits

      await expect(
        service.update('ev-1', { code: 'VC-002' }, 'actor-1'),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.evidence.update).not.toHaveBeenCalled();
    });

    it('refuses to update evidence outside the caller scope', async () => {
      mockPrisma.evidence.findFirst.mockResolvedValue({
        id: 'ev-1',
        case: CASE_A,
      });

      await expect(
        service.update(
          'ev-1',
          { name: 'X' },
          'actor-1',
          undefined,
          SCOPE_TEAM_B,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.evidence.update).not.toHaveBeenCalled();
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft deletes rather than removing the row', async () => {
      mockPrisma.evidence.findFirst.mockResolvedValue({
        id: 'ev-1',
        code: 'VC-001',
        caseId: 'case-a',
        case: CASE_A,
      });
      mockPrisma.evidence.update.mockResolvedValue({});

      await service.delete('ev-1', 'actor-1');

      expect(mockPrisma.evidence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: expect.any(Date) },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EVIDENCE_DELETED' }),
      );
    });

    it('refuses to delete evidence outside the caller scope', async () => {
      mockPrisma.evidence.findFirst.mockResolvedValue({
        id: 'ev-1',
        case: CASE_A,
      });

      await expect(
        service.delete('ev-1', 'actor-1', undefined, SCOPE_TEAM_B),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── restore ───────────────────────────────────────────────────────────────
  // Evidence is legal proof; without this path a mis-click needs SSH access to
  // production. See TODOS RESTORE-001 for the nine entities that shipped
  // without one.

  describe('restore', () => {
    const deleted = {
      id: 'ev-1',
      code: 'VC-001',
      name: 'Dao',
      deletedAt: new Date(Date.now() - 2 * 3_600_000),
      case: CASE_A,
    };

    it('clears deletedAt and audits the reason inside one transaction', async () => {
      mockPrisma.evidence.findFirst
        .mockResolvedValueOnce(deleted)
        .mockResolvedValueOnce(null); // no live record holds the code
      mockPrisma.evidence.update.mockResolvedValue({});

      await service.restore('ev-1', 'Xóa nhầm khi nhập liệu', 'actor-1');

      expect(mockPrisma.evidence.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { deletedAt: null } }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EVIDENCE_RESTORED',
          metadata: expect.objectContaining({
            reason: 'Xóa nhầm khi nhập liệu',
            hoursAfterDeletion: 2,
          }),
        }),
        mockPrisma,
      );
    });

    it('takes a row lock on the parent case before checking the code', async () => {
      // The clash check and the restore have to be inseparable. Without the
      // lock a concurrent create can take the code between them.
      mockPrisma.evidence.findFirst
        .mockResolvedValueOnce(deleted)
        .mockResolvedValueOnce(null);
      mockPrisma.evidence.update.mockResolvedValue({});

      await service.restore('ev-1', 'Xóa nhầm khi nhập liệu', 'actor-1');

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('refuses to restore when the code is now taken by a live record', async () => {
      // Uniqueness is only checked among live rows, so a replacement can be
      // created under the same code while the original sits deleted. Restoring
      // blindly would leave two live VC-001 in one case.
      mockPrisma.evidence.findFirst
        .mockResolvedValueOnce(deleted)
        .mockResolvedValueOnce({ id: 'ev-replacement' });

      await expect(
        service.restore('ev-1', 'lý do đủ dài để qua validator', 'actor-1'),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.evidence.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the record is not deleted', async () => {
      mockPrisma.evidence.findFirst.mockReset().mockResolvedValue(null);

      await expect(
        service.restore('ev-1', 'lý do đủ dài', 'a'),
      ).rejects.toThrow(NotFoundException);
    });

    it('will not restore under a soft-deleted case', async () => {
      // The parent filter lives in the query, so a deleted case makes the
      // lookup miss entirely rather than producing a live orphan child.
      mockPrisma.evidence.findFirst.mockReset().mockResolvedValue(null);

      await expect(
        service.restore('ev-1', 'lý do đủ dài', 'a'),
      ).rejects.toThrow(NotFoundException);
      const arg = firstArg<{ where: Record<string, unknown> }>(
        mockPrisma.evidence.findFirst,
      );
      expect(arg.where.case).toEqual({ deletedAt: null });
    });

    it('refuses to restore evidence outside the caller scope', async () => {
      mockPrisma.evidence.findFirst.mockReset().mockResolvedValue(deleted);

      await expect(
        service.restore('ev-1', 'lý do đủ dài', 'a', undefined, SCOPE_TEAM_B),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.evidence.update).not.toHaveBeenCalled();
    });
  });

  // ── listDeleted ───────────────────────────────────────────────────────────

  describe('listDeleted', () => {
    it('returns only soft-deleted rows, scoped to the caller', async () => {
      mockPrisma.evidence.findMany.mockResolvedValue([]);
      mockPrisma.evidence.count.mockResolvedValue(0);

      await service.listDeleted({}, SCOPE_TEAM_A);

      const arg = firstArg<FindManyArgs>(mockPrisma.evidence.findMany);
      expect(arg.where.deletedAt).toEqual({ not: null });
      expect(arg.where.case).toBeDefined();
    });

    it('caps the page size at 100', async () => {
      mockPrisma.evidence.findMany.mockResolvedValue([]);
      mockPrisma.evidence.count.mockResolvedValue(0);

      await service.listDeleted({ limit: 5000 });

      const arg = firstArg<FindManyArgs>(mockPrisma.evidence.findMany);
      expect(arg.take).toBe(100);
    });
  });
});
