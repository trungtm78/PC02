/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * CasesService Unit Tests
 * Coverage target: >= 80%
 *
 * Tests cover:
 *   - getList: pagination, search, filters
 *   - getById: found (with petitions) / not found
 *   - create: success without petition, success with petitionType (auto-create),
 *             invalid investigatorId, STT generation
 *   - update: success, not found, status change history,
 *             petitionType sync (update existing / create new)
 *   - delete: success, not found (soft delete)
 *   - getStatusHistory: returns history
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { CaseStatus, PetitionStatus, CapDoToiPham, Prisma } from '@prisma/client';
import { ROLE_NAMES } from '../common/constants/role.constants';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCase = {
  id: 'case-001',
  name: 'Vụ án tham nhũng',
  crime: 'Tham nhũng',
  status: CaseStatus.TIEP_NHAN,
  investigatorId: 'user-001',
  deadline: new Date('2026-06-01'),
  unit: 'Công an Quận 1',
  subjectsCount: 0,
  metadata: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  investigator: {
    id: 'user-001',
    firstName: 'Nguyen',
    lastName: 'Van A',
    username: 'nguyenvana',
  },
};

const mockPetition = {
  id: 'petition-001',
  stt: 'DT-2026-00001',
  receivedDate: new Date(),
  senderName: 'Trần Thị Test',
  petitionType: 'Tố cáo',
  status: PetitionStatus.MOI_TIEP_NHAN,
  linkedCaseId: 'case-001',
  enteredById: 'actor-001',
  unit: 'Công an Quận 1',
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  case: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  petition: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  team: {
    findFirst: jest.fn(),
  },
  userTeam: {
    findFirst: jest.fn(),
  },
  caseStatusHistory: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn() as any,
};

// v0.31.0.2: SettingsService mock for THOI_HAN_XOA_VU_AN
const mockSettings = {
  getNumericValue: jest.fn().mockResolvedValue(72),
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
  // v0.30: CASE_UPDATED now uses wrapUpdate to capture full before/after.
  wrapUpdate: jest.fn(async (opts: any) => {
    await opts.fetchFn();
    const after = await opts.updateFn();
    await mockAudit.log({
      userId: opts.userId,
      action: opts.action,
      subject: opts.subject,
      subjectId: opts.subjectId,
      metadata: { before: {}, after: {} },
      ipAddress: opts.meta?.ipAddress,
      userAgent: opts.meta?.userAgent,
    });
    return after;
  }),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('CasesService', () => {
  let service: CasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: SettingsService, useValue: mockSettings }, // v0.31.0.2
      ],
    }).compile();

    service = module.get<CasesService>(CasesService);
    jest.clearAllMocks();
  });

  // ── getList ────────────────────────────────────────────────────────────────

  describe('getList', () => {
    it('should return paginated results', async () => {
      mockPrisma.case.findMany.mockResolvedValue([mockCase]);
      mockPrisma.case.count.mockResolvedValue(1);

      const result = await service.getList({ limit: 20, offset: 0 });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should apply search filter', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);
      mockPrisma.case.count.mockResolvedValue(0);

      await service.getList({ search: 'tham nhũng' });

      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: 'tham nhũng', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);
      mockPrisma.case.count.mockResolvedValue(0);

      await service.getList({ status: CaseStatus.DANG_DIEU_TRA });

      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: CaseStatus.DANG_DIEU_TRA }),
        }),
      );
    });

    it('should filter overdue cases', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);
      mockPrisma.case.count.mockResolvedValue(0);

      await service.getList({ overdue: true });

      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deadline: { lt: expect.any(Date) },
            status: {
              notIn: [CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU, CaseStatus.DINH_CHI],
            },
          }),
        }),
      );
    });
  });

  // ── getById ────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return case with petitions', async () => {
      mockPrisma.case.findFirst.mockResolvedValue({
        ...mockCase,
        petitions: [mockPetition],
      });

      const result = await service.getById('case-001');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('case-001');
      expect(result.data.petitions).toHaveLength(1);
      expect(mockPrisma.case.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            petitions: expect.any(Object),
          }),
        }),
      );
    });

    it('should throw NotFoundException when case not found', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create case without petition when no petitionType', async () => {
      mockPrisma.case.create.mockResolvedValue(mockCase);

      const result = await service.create(
        { name: 'Vụ án test', crime: 'Tham nhũng', unit: 'Công an Quận 1' },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Vụ án tham nhũng');
      expect(mockPrisma.case.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASE_CREATED' }),
      );
      // No petition creation
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should auto-create petition when petitionType is in metadata', async () => {
      const txCase = { ...mockCase, id: 'case-new' };
      const txPetition = { ...mockPetition, id: 'petition-new', stt: 'DT-2026-00002' };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: {
            create: jest.fn().mockResolvedValue(txCase),
          },
          petition: {
            findFirst: jest.fn().mockResolvedValue({ stt: 'DT-2026-00001' }),
            create: jest.fn().mockResolvedValue(txPetition),
          },
        };
        return fn(tx);
      });

      const result = await service.create(
        {
          name: 'Vụ án mới',
          unit: 'Công an Quận 1',
          metadata: { petitionType: 'Tố cáo', reporter: 'Nguyễn Văn B' },
        },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('linkedPetition');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // Two audit logs: CASE_CREATED + PETITION_AUTO_CREATED
      expect(mockAudit.log).toHaveBeenCalledTimes(2);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASE_CREATED' }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PETITION_AUTO_CREATED' }),
      );
    });

    it('should generate STT with correct format DT-YYYY-NNNNN', async () => {
      const year = new Date().getFullYear();

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: {
            create: jest.fn().mockResolvedValue(mockCase),
          },
          petition: {
            findFirst: jest.fn().mockResolvedValue(null), // No existing petitions
            create: jest.fn().mockImplementation((args: any) => {
              // Verify STT format
              expect(args.data.stt).toBe(`DT-${year}-00001`);
              return { ...mockPetition, stt: args.data.stt };
            }),
          },
        };
        return fn(tx);
      });

      await service.create(
        {
          name: 'Vụ án',
          metadata: { petitionType: 'Khiếu nại' },
        },
        'actor-001',
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should increment STT from last existing petition', async () => {
      const year = new Date().getFullYear();

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: {
            create: jest.fn().mockResolvedValue(mockCase),
          },
          petition: {
            findFirst: jest.fn().mockResolvedValue({ stt: `DT-${year}-00042` }),
            create: jest.fn().mockImplementation((args: any) => {
              expect(args.data.stt).toBe(`DT-${year}-00043`);
              return { ...mockPetition, stt: args.data.stt };
            }),
          },
        };
        return fn(tx);
      });

      await service.create(
        {
          name: 'Vụ án',
          metadata: { petitionType: 'Tố cáo' },
        },
        'actor-001',
      );
    });

    it('should use "Chưa xác định" when reporter is empty', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: {
            create: jest.fn().mockResolvedValue(mockCase),
          },
          petition: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((args: any) => {
              expect(args.data.senderName).toBe('Chưa xác định');
              return mockPetition;
            }),
          },
        };
        return fn(tx);
      });

      await service.create(
        {
          name: 'Vụ án',
          metadata: { petitionType: 'Khiếu nại' },
        },
        'actor-001',
      );
    });

    it('should throw BadRequestException for invalid investigatorId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { name: 'Test', investigatorId: 'invalid-user' },
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set default status to TIEP_NHAN', async () => {
      mockPrisma.case.create.mockResolvedValue(mockCase);

      await service.create({ name: 'Test' }, 'actor-001');

      expect(mockPrisma.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CaseStatus.TIEP_NHAN,
          }),
        }),
      );
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update case successfully', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(mockCase);
      mockPrisma.case.update.mockResolvedValue({
        ...mockCase,
        name: 'Updated name',
      });

      const result = await service.update(
        'case-001',
        { name: 'Updated name' },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated name');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASE_UPDATED' }),
      );
    });

    // v0.30: CASE_UPDATED must go through wrapUpdate so the audit row carries
    // full before/after snapshot for inline diff display.
    it('v0.30: uses audit.wrapUpdate (not audit.log direct) for CASE_UPDATED', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(mockCase);
      mockPrisma.case.update.mockResolvedValue({
        ...mockCase,
        name: 'Updated name',
      });

      await service.update('case-001', { name: 'Updated name' }, 'actor-001');

      expect(mockAudit.wrapUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CASE_UPDATED',
          subject: 'Case',
          subjectId: 'case-001',
          userId: 'actor-001',
          fetchFn: expect.any(Function),
          updateFn: expect.any(Function),
        }),
      );
    });

    it('should throw NotFoundException when case not found', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }, 'actor-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create status history when status changes', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(mockCase);
      mockPrisma.case.update.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.DANG_DIEU_TRA,
      });
      mockPrisma.caseStatusHistory.create.mockResolvedValue({});

      await service.update(
        'case-001',
        { status: CaseStatus.DANG_DIEU_TRA },
        'actor-001',
      );

      expect(mockPrisma.caseStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caseId: 'case-001',
          fromStatus: CaseStatus.TIEP_NHAN,
          toStatus: CaseStatus.DANG_DIEU_TRA,
        }),
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASE_STATUS_CHANGED' }),
      );
    });

    // ── [CONTRACT] InitialCasesPage "nhận xử lý" ──────────────────────────────
    // These tests protect the exact flow: user clicks "Xác nhận nhận xử lý"
    // → frontend calls PUT /cases/:id { status: DANG_DIEU_TRA }
    // → case disappears from the TIEP_NHAN list

    it('[CONTRACT] TIEP_NHAN → DANG_DIEU_TRA transition returns success', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(mockCase); // TIEP_NHAN
      mockPrisma.case.update.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.DANG_DIEU_TRA,
      });
      mockPrisma.caseStatusHistory.create.mockResolvedValue({});

      const result = await service.update(
        'case-001',
        { status: CaseStatus.DANG_DIEU_TRA },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(CaseStatus.DANG_DIEU_TRA);
    });

    it('[CONTRACT] getList with status=TIEP_NHAN only returns pending cases', async () => {
      mockPrisma.case.findMany.mockResolvedValue([mockCase]);
      mockPrisma.case.count.mockResolvedValue(1);

      await service.getList({ status: CaseStatus.TIEP_NHAN });

      const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
      expect(callArgs.where).toMatchObject({ status: CaseStatus.TIEP_NHAN });
    });

    it('[CONTRACT] after TIEP_NHAN→DANG_DIEU_TRA, status history records the fromStatus', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(mockCase); // status = TIEP_NHAN
      mockPrisma.case.update.mockResolvedValue({ ...mockCase, status: CaseStatus.DANG_DIEU_TRA });
      mockPrisma.caseStatusHistory.create.mockResolvedValue({});

      await service.update('case-001', { status: CaseStatus.DANG_DIEU_TRA }, 'actor-001');

      expect(mockPrisma.caseStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caseId: 'case-001',
          fromStatus: CaseStatus.TIEP_NHAN,
          toStatus: CaseStatus.DANG_DIEU_TRA,
          changedById: 'actor-001',
        }),
      });
    });

    it('should update linked petition when petitionType changes', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(mockCase);
      mockPrisma.case.update.mockResolvedValue(mockCase);
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await service.update(
        'case-001',
        { metadata: { petitionType: 'Khiếu nại' } },
        'actor-001',
      );

      expect(mockPrisma.petition.update).toHaveBeenCalledWith({
        where: { id: 'petition-001' },
        data: { petitionType: 'Khiếu nại' },
      });
    });

    it('should create new petition when petitionType added and no linked petition exists', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(mockCase);
      mockPrisma.case.update.mockResolvedValue(mockCase);
      mockPrisma.petition.findFirst.mockResolvedValue(null); // No linked petition

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          petition: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockPetition),
          },
        };
        return fn(tx);
      });

      await service.update(
        'case-001',
        { metadata: { petitionType: 'Tố cáo', reporter: 'Test Reporter' } },
        'actor-001',
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PETITION_AUTO_CREATED' }),
      );
    });

    it('should throw BadRequestException for invalid investigatorId on update', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(mockCase);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          'case-001',
          { investigatorId: 'invalid-user' },
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── delete (v0.31.0.2 — 8-step chain, transactional, mirror Incident) ─────

  describe('delete (v0.31.0.2)', () => {
    const REASON = 'Xóa dữ liệu test nhập sai';
    const ACTOR_ID = 'creator-001';

    // Common mock setup: case with createdById = ACTOR_ID, all linked counts = 0
    const setupBasicCase = (overrides: Record<string, unknown> = {}) => {
      const baseCase = {
        ...mockCase,
        createdById: ACTOR_ID,
        createdAt: new Date(),
        subjects: [],
        lawyers: [],
        conclusions: [],
        documents: [],
        linkedIncidents: [],
        ...overrides,
      };
      mockPrisma.case.findFirst.mockResolvedValue(baseCase);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          case: { update: jest.fn().mockResolvedValue({ ...baseCase, deletedAt: new Date() }) },
        };
        await cb(tx);
        return undefined;
      });
      return baseCase;
    };

    it('BE-10: soft deletes case + audit logged in transaction with reason', async () => {
      setupBasicCase();
      const result = await service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR);
      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CASE_DELETED',
          metadata: expect.objectContaining({ reason: REASON, softDelete: true }),
        }),
        expect.anything(),
      );
    });

    it('throws NotFoundException khi case không tồn tại', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(null);
      await expect(
        service.delete('nonexistent', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('BE-1: throws BadRequest khi status !== TIEP_NHAN', async () => {
      setupBasicCase({ status: CaseStatus.DANG_DIEU_TRA });
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(/Tiếp nhận/);
    });

    it('BE-2: throws khi subjects.length > 0', async () => {
      setupBasicCase({ subjects: [{ id: 's1' }, { id: 's2' }] });
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(/2 đối tượng/);
    });

    it('BE-3: throws khi lawyers.length > 0', async () => {
      setupBasicCase({ lawyers: [{ id: 'l1' }] });
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(/1 luật sư/);
    });

    it('BE-4: throws khi conclusions.length > 0', async () => {
      setupBasicCase({ conclusions: [{ id: 'c1' }] });
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(/kết luận/);
    });

    it('BE-5: throws khi documents.length > 0', async () => {
      setupBasicCase({ documents: [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }] });
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(/3 tài liệu/);
    });

    it('BE-6: throws khi linkedIncidents.length > 0', async () => {
      setupBasicCase({ linkedIncidents: [{ id: 'i1' }] });
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(/vụ việc/);
    });

    it('BE-7a: throws Forbidden khi không phải creator/admin', async () => {
      setupBasicCase({ createdById: 'other-user' });
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('BE-7b: throws specific NULL message khi createdById is null (legacy data)', async () => {
      setupBasicCase({ createdById: null });
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(/dữ liệu cũ/);
    });

    it('BE-8: throws BadRequest khi quá window và không phải admin', async () => {
      const oldCase = setupBasicCase({
        createdAt: new Date(Date.now() - 100 * 3_600_000), // 100h ago
      });
      mockSettings.getNumericValue.mockResolvedValueOnce(72);
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(/72 giờ/);
    });

    it('BE-9: ADMIN bypasses window even when overdue', async () => {
      setupBasicCase({
        createdById: 'someone-else',
        createdAt: new Date(Date.now() - 500 * 3_600_000),
      });
      mockSettings.getNumericValue.mockResolvedValueOnce(72);
      const result = await service.delete('case-001', REASON, 'admin-id', ROLE_NAMES.ADMIN);
      expect(result.success).toBe(true);
    });

    it('BE-11: TOCTOU — concurrent status change → P2025 → BadRequest', async () => {
      setupBasicCase();
      const p2025 = new Prisma.PrismaClientKnownRequestError(
        'Record to update not found',
        { code: 'P2025', clientVersion: '7.8.0' },
      );
      mockPrisma.$transaction.mockRejectedValueOnce(p2025);
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(/đã đổi trạng thái/);
    });

    it('BE-12: DataScope deny → ForbiddenException via checkWriteScope', async () => {
      setupBasicCase({ assignedTeamId: 'team-A', investigatorId: 'someone-else' });
      // Scope excludes team-A and doesn't match investigator
      const restrictiveScope = {
        userIds: ['other-user'],
        writableTeamIds: ['team-B'], // doesn't include team-A
      } as any;
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR, undefined, restrictiveScope),
      ).rejects.toThrow(ForbiddenException);
    });

    it('BE: only counts ACTIVE linked subjects (deletedAt:null filter)', async () => {
      setupBasicCase();
      // Verify findFirst was called with deletedAt:null filter on subjects
      await service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR);
      expect(mockPrisma.case.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            subjects: { where: { deletedAt: null }, select: { id: true } },
            lawyers: { where: { deletedAt: null }, select: { id: true } },
            conclusions: { where: { deletedAt: null }, select: { id: true } },
            documents: { where: { deletedAt: null }, select: { id: true } },
            linkedIncidents: { where: { deletedAt: null }, select: { id: true } },
          }),
        }),
      );
    });
  });

  // ── previewDelete (v0.31.0.2) ──────────────────────────────────────────────

  describe('previewDelete (v0.31.0.2)', () => {
    it('BE-13a: returns canDelete=true với no blockers', async () => {
      mockPrisma.case.findFirst.mockResolvedValue({
        ...mockCase,
        subjects: [], lawyers: [], conclusions: [], documents: [], linkedIncidents: [],
      });
      const result = await service.previewDelete('case-001');
      expect(result.canDelete).toBe(true);
      expect(result.reasonsIfBlocked).toEqual([]);
      expect(result.blockers).toEqual({
        subjects: 0, lawyers: 0, conclusions: 0, documents: 0, linkedIncidents: 0,
      });
    });

    it('BE-13b: returns canDelete=false với linked entities + status reason', async () => {
      mockPrisma.case.findFirst.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.DANG_DIEU_TRA,
        subjects: [{ id: 's1' }, { id: 's2' }],
        lawyers: [],
        conclusions: [{ id: 'c1' }],
        documents: [],
        linkedIncidents: [],
      });
      const result = await service.previewDelete('case-001');
      expect(result.canDelete).toBe(false);
      expect(result.blockers.subjects).toBe(2);
      expect(result.blockers.conclusions).toBe(1);
      expect(result.reasonsIfBlocked.length).toBeGreaterThanOrEqual(3); // status + subjects + conclusions
      expect(result.reasonsIfBlocked.some((r) => /Tiếp nhận/.test(r))).toBe(true);
      expect(result.reasonsIfBlocked.some((r) => /2 đối tượng/.test(r))).toBe(true);
    });

    it('throws NotFoundException khi case không tồn tại', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(null);
      await expect(service.previewDelete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getStatusHistory ───────────────────────────────────────────────────────

  describe('getStatusHistory', () => {
    it('should return status history for a case', async () => {
      const mockHistory = [
        {
          id: 'history-001',
          caseId: 'case-001',
          fromStatus: CaseStatus.TIEP_NHAN,
          toStatus: CaseStatus.DANG_DIEU_TRA,
          changedAt: new Date(),
          changedBy: { id: 'user-001', firstName: 'Test', lastName: 'User', username: 'testuser' },
        },
      ];
      mockPrisma.caseStatusHistory.findMany.mockResolvedValue(mockHistory);

      const result = await service.getStatusHistory('case-001');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].fromStatus).toBe(CaseStatus.TIEP_NHAN);
    });
  });

  // ── GAP-5: capDoToiPham (BLHS 2015 Điều 9) ───────────────────────────────

  describe('create — capDoToiPham (GAP-5)', () => {
    it('creates case with capDoToiPham field stored', async () => {
      const withSeverity = {
        ...mockCase,
        capDoToiPham: CapDoToiPham.RAT_NGHIEM_TRONG,
      };
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-001' });
      mockPrisma.case.create.mockResolvedValue(withSeverity);

      const result = await service.create(
        {
          name: 'Vụ án rất nghiêm trọng',
          capDoToiPham: CapDoToiPham.RAT_NGHIEM_TRONG,
        },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.data.capDoToiPham).toBe(CapDoToiPham.RAT_NGHIEM_TRONG);
      expect(mockPrisma.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ capDoToiPham: CapDoToiPham.RAT_NGHIEM_TRONG }),
        }),
      );
    });

    it('update sets capDoToiPham on existing case', async () => {
      const existing = { ...mockCase, capDoToiPham: null };
      const updated = { ...mockCase, capDoToiPham: CapDoToiPham.DAC_BIET_NGHIEM_TRONG };
      mockPrisma.case.findFirst.mockResolvedValue(existing);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-001' });
      mockPrisma.case.update.mockResolvedValue(updated);

      const result = await service.update(
        'case-001',
        { capDoToiPham: CapDoToiPham.DAC_BIET_NGHIEM_TRONG },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ capDoToiPham: CapDoToiPham.DAC_BIET_NGHIEM_TRONG }),
        }),
      );
    });

    describe('optimistic locking', () => {
      const stalestamp = '2026-01-01T00:00:00.000Z';

      it('throws ConflictException when P2025 with expectedUpdatedAt (stale version)', async () => {
        mockPrisma.case.findFirst.mockResolvedValue(mockCase);
        mockPrisma.case.update.mockRejectedValue({ code: 'P2025' });

        await expect(
          service.update('case-001', { name: 'Edited', expectedUpdatedAt: stalestamp }, 'actor-001'),
        ).rejects.toThrow(ConflictException);
      });

      it('passes updatedAt in where clause when expectedUpdatedAt provided', async () => {
        mockPrisma.case.findFirst.mockResolvedValue(mockCase);
        mockPrisma.case.update.mockResolvedValue({ ...mockCase, name: 'Edited' });

        await service.update('case-001', { name: 'Edited', expectedUpdatedAt: stalestamp }, 'actor-001');

        expect(mockPrisma.case.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ id: 'case-001', updatedAt: new Date(stalestamp) }),
          }),
        );
      });

      it('does NOT add updatedAt to where clause when expectedUpdatedAt absent (backward compat)', async () => {
        mockPrisma.case.findFirst.mockResolvedValue(mockCase);
        mockPrisma.case.update.mockResolvedValue(mockCase);

        await service.update('case-001', { name: 'Edited' }, 'actor-001');

        const callArgs = mockPrisma.case.update.mock.calls[0][0];
        expect(callArgs.where).not.toHaveProperty('updatedAt');
      });

      it('re-throws P2025 as-is when expectedUpdatedAt absent (no stale-version check intended)', async () => {
        mockPrisma.case.findFirst.mockResolvedValue(mockCase);
        mockPrisma.case.update.mockRejectedValue({ code: 'P2025' });

        await expect(
          service.update('case-001', { name: 'Edited' }, 'actor-001'),
        ).rejects.toMatchObject({ code: 'P2025' });
      });
    });
  });

  // ── assignCase ─────────────────────────────────────────────────────────────

  describe('assignCase', () => {
    const mockTeam = { id: 'team-001', name: 'Tổ 1', isActive: true };
    const existingCase = {
      ...mockCase,
      assignedTeamId: null,
      investigatorId: null,
    };

    it('assigns case and logs audit with from/to metadata', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(existingCase);
      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.userTeam.findFirst.mockResolvedValue({ userId: 'user-001', teamId: 'team-001' });
      mockPrisma.case.update.mockResolvedValue({ ...existingCase, assignedTeamId: 'team-001', investigatorId: 'user-001' });

      const result = await service.assignCase(
        'case-001',
        { assignedTeamId: 'team-001', investigatorId: 'user-001' },
        'dispatcher-001',
      );

      expect(result.success).toBe(true);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CASE_ASSIGNED',
          metadata: expect.objectContaining({
            fromTeamId: null,
            toTeamId: 'team-001',
            fromInvestigatorId: null,
            toInvestigatorId: 'user-001',
            dispatchedBy: 'dispatcher-001',
          }),
        }),
      );
    });

    it('throws NotFoundException when case not found', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(null);

      await expect(
        service.assignCase('bad-id', { assignedTeamId: 'team-001' }, 'dispatcher-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when team not found or inactive', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(existingCase);
      mockPrisma.team.findFirst.mockResolvedValue(null);

      await expect(
        service.assignCase('case-001', { assignedTeamId: 'bad-team' }, 'dispatcher-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when investigatorId does not belong to the assigned team', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(existingCase);
      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.userTeam.findFirst.mockResolvedValue(null); // not a member

      await expect(
        service.assignCase('case-001', { assignedTeamId: 'team-001', investigatorId: 'other-user' }, 'dispatcher-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException on P2025 with expectedUpdatedAt (stale version)', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(existingCase);
      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.userTeam.findFirst.mockResolvedValue(null);
      // No investigatorId so userTeam check skipped
      mockPrisma.case.update.mockRejectedValue({ code: 'P2025' });

      await expect(
        service.assignCase('case-001', { assignedTeamId: 'team-001', expectedUpdatedAt: new Date() }, 'dispatcher-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('assigns without investigatorId (team-only assignment)', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(existingCase);
      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.case.update.mockResolvedValue({ ...existingCase, assignedTeamId: 'team-001' });

      await service.assignCase('case-001', { assignedTeamId: 'team-001' }, 'dispatcher-001');

      expect(mockPrisma.userTeam.findFirst).not.toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ toInvestigatorId: null }),
        }),
      );
    });
  });
});
