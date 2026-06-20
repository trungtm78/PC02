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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { CaseStatus, PetitionStatus, CapDoToiPham, Prisma } from '@prisma/client';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

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
    findUnique: jest.fn(),
  },
  userTeam: {
    findFirst: jest.fn(),
  },
  caseStatusHistory: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  incident: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn() as any,
};

// v0.31.0.2: SettingsService mock for THOI_HAN_XOA_VU_AN
const mockSettings = {
  getNumericValue: jest.fn().mockResolvedValue(72),
};

// DocumentNumbersService mock — auto-generate codes for cases + auto-incidents
const mockDocNums = {
  commit: jest.fn().mockResolvedValue({ number: 'HS-2026-001', logId: 'log-case-001', changed: false }),
  commitWithTx: jest.fn().mockResolvedValue({ number: 'HS-2026-001', logId: 'log-case-001', changed: false }),
  updateLogDocumentId: jest.fn().mockResolvedValue(undefined),
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
        { provide: DocumentNumbersService, useValue: mockDocNums },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
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

    it('filters by ngayTiepNhan range when ngayTiepNhanFrom and ngayTiepNhanTo provided', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);
      mockPrisma.case.count.mockResolvedValue(0);

      await service.getList({
        ngayTiepNhanFrom: '2026-01-01',
        ngayTiepNhanTo: '2026-03-31',
        caseType: 'UY_THAC_DIEU_TRA' as any,
      });

      const whereArg = mockPrisma.case.findMany.mock.calls[0][0].where;
      expect(whereArg.ngayTiepNhan).toMatchObject({
        gte: new Date('2026-01-01'),
        lte: new Date('2026-03-31T23:59:59Z'),
      });
    });

    it('filters by investigatorName with case-insensitive partial match on firstName or lastName', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);
      mockPrisma.case.count.mockResolvedValue(0);

      await service.getList({
        investigatorName: 'Nguyễn',
        caseType: 'UY_THAC_DIEU_TRA' as any,
      });

      const whereArg = mockPrisma.case.findMany.mock.calls[0][0].where;
      expect(whereArg.investigator).toMatchObject({
        OR: [
          { firstName: { contains: 'Nguyễn', mode: 'insensitive' } },
          { lastName: { contains: 'Nguyễn', mode: 'insensitive' } },
        ],
      });
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
      const tx = {
        case: { create: jest.fn().mockResolvedValue(mockCase) },
        incident: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
        documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

      const result = await service.create(
        {
          name: 'Vụ án test',
          crime: 'Tham nhũng',
          unit: 'Công an Quận 1',
          caseProvenance: 'DIRECT_DISCOVERY' as any, // v0.37.2 required
        },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Vụ án tham nhũng');
      expect(tx.case.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASE_CREATED' }),
      );
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    // v0.37.1 — REMOVED tests:
    // - 'should auto-create petition when petitionType is in metadata'
    // - 'should generate STT with correct format DT-YYYY-NNNNN'
    // - 'should increment STT from last existing petition'
    // - 'should use "Chưa xác định" when reporter is empty'
    // Reason: Auto-create phantom Petition removed (provenance violation per BLTTHS Đ.143).
    // Replaced by compat shim + caseProvenance model in 'v0.37.1 create with caseProvenance' describe block below.
    // STT generation moved out of cases.service.create flow; generateStt() still exists for direct Petition creation.

    it('should throw BadRequestException for invalid investigatorId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { name: 'Test', investigatorId: 'invalid-user', caseProvenance: 'DIRECT_DISCOVERY' as any },
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set default status to TIEP_NHAN', async () => {
      const tx = {
        case: { create: jest.fn().mockResolvedValue(mockCase) },
        incident: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
        documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

      await service.create({ name: 'Test', caseProvenance: 'DIRECT_DISCOVERY' as any }, 'actor-001');

      expect(tx.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CaseStatus.TIEP_NHAN,
          }),
        }),
      );
    });

    // v0.68 — UY_THAC_DIEU_TRA caseProvenance dùng 'UTDT' docType thay vì 'CASE'
    it('uses UTDT docType when caseProvenance is UY_THAC_DIEU_TRA', async () => {
      const tx = {
        case: { create: jest.fn().mockResolvedValue({ ...mockCase, caseProvenance: 'UY_THAC_DIEU_TRA' }) },
        incident: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
        documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

      await service.create(
        { name: 'Ủy thác điều tra test', caseProvenance: 'UY_THAC_DIEU_TRA' as any },
        'actor-001',
      );

      expect(mockDocNums.commitWithTx).toHaveBeenCalledWith(
        'UTDT',
        expect.anything(),
        expect.anything(),
      );
    });

    it('uses CASE docType for non-UTDT provenance', async () => {
      const tx = {
        case: { create: jest.fn().mockResolvedValue(mockCase) },
        incident: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
        documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

      await service.create(
        { name: 'Vụ án bình thường', caseProvenance: 'DIRECT_DISCOVERY' as any },
        'actor-001',
      );

      expect(mockDocNums.commitWithTx).toHaveBeenCalledWith(
        'CASE',
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ── v0.37.1 — Provenance model ────────────────────────────────────────────
  describe('v0.37.1 create with caseProvenance', () => {
    const baseProvenanceDto = {
      name: 'Vụ án provenance test',
      unit: 'Công an Quận 1',
    };

    it('FROM_PETITION: creates Case and updates Petition.linkedCaseId atomically', async () => {
      const petitionUpdatedAt = new Date('2026-05-22T10:00:00.000Z');
      const existingPetition = {
        ...mockPetition,
        id: 'pet-source',
        linkedCaseId: null,
        updatedAt: petitionUpdatedAt,
      };
      const newCase = { ...mockCase, id: 'case-new', linkedPetitionId: 'pet-source' };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue(newCase) },
          petition: {
            findFirst: jest.fn().mockResolvedValue(existingPetition),
            update: jest.fn().mockResolvedValue({ ...existingPetition, linkedCaseId: 'case-new' }),
          },
          documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.create(
        {
          ...baseProvenanceDto,
          caseProvenance: 'FROM_PETITION' as any,
          linkedPetitionId: 'pet-source',
          expectedPetitionUpdatedAt: petitionUpdatedAt.toISOString(),
        },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASE_CREATED' }),
      );
      // Critically: should NOT log PETITION_AUTO_CREATED — no phantom Petition
      expect(mockAudit.log).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PETITION_AUTO_CREATED' }),
      );
    });

    it('FROM_PETITION: throws NotFoundException when Petition not found or out of scope', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: { create: jest.fn() },
          petition: {
            findFirst: jest.fn().mockResolvedValue(null), // not found OR out of scope
            update: jest.fn(),
          },
          documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      await expect(
        service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'FROM_PETITION' as any,
            linkedPetitionId: 'pet-out-of-scope',
            expectedPetitionUpdatedAt: new Date().toISOString(),
          },
          'actor-001',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('FROM_PETITION: throws ConflictException on stale expectedPetitionUpdatedAt (P2025)', async () => {
      const existingPetition = { ...mockPetition, id: 'pet-source', linkedCaseId: null, updatedAt: new Date() };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue({ ...mockCase, id: 'case-new' }) },
          petition: {
            findFirst: jest.fn().mockResolvedValue(existingPetition),
            update: jest.fn().mockRejectedValue(
              Object.assign(new Error('Record to update not found'), { code: 'P2025' }),
            ),
          },
          documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      await expect(
        service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'FROM_PETITION' as any,
            linkedPetitionId: 'pet-source',
            expectedPetitionUpdatedAt: '2020-01-01T00:00:00.000Z', // stale
          },
          'actor-001',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('DIRECT_DISCOVERY: creates Case via $transaction (now atomic)', async () => {
      const tx = {
        case: { create: jest.fn().mockResolvedValue({ ...mockCase, caseProvenance: 'DIRECT_DISCOVERY' }) },
        incident: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          update: jest.fn(),
        },
        documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

      const result = await service.create(
        {
          ...baseProvenanceDto,
          caseProvenance: 'DIRECT_DISCOVERY' as any,
        },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // No incident fields → no auto-create
      expect(tx.incident.create).not.toHaveBeenCalled();
      expect(tx.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ caseProvenance: 'DIRECT_DISCOVERY' }),
        }),
      );
    });

    // PR-M2: field-parity Case mới (ghiChuKhac/toiDanhKhacIds) + fix rớt-data soKLDT/soQDDieuTraLai ở create.
    it('persists ghiChuKhac/toiDanhKhacIds + KLĐT/điều-tra-lại fields khi create (chống rớt-data)', async () => {
      const tx = {
        case: { create: jest.fn().mockResolvedValue({ ...mockCase, caseProvenance: 'DIRECT_DISCOVERY' }) },
        incident: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          update: jest.fn(),
        },
        documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

      await service.create(
        {
          ...baseProvenanceDto,
          caseProvenance: 'DIRECT_DISCOVERY' as any,
          ghiChuKhac: 'Ghi chú tự do từ hệ cũ',
          toiDanhKhacIds: ['crime-1', 'crime-2'],
          soKLDT: 'KLĐT-2026-01',
          ngayKLDT: '2026-06-01',
          soQDDieuTraLai: 'QĐ-ĐTL-2026-01',
          ngayQDDieuTraLai: '2026-06-02',
        } as any,
        'actor-001',
      );

      expect(tx.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ghiChuKhac: 'Ghi chú tự do từ hệ cũ',
            toiDanhKhacIds: ['crime-1', 'crime-2'],
            soKLDT: 'KLĐT-2026-01',
            ngayKLDT: expect.any(Date),
            soQDDieuTraLai: 'QĐ-ĐTL-2026-01',
            ngayQDDieuTraLai: expect.any(Date),
          }),
        }),
      );
    });

    // ── auto-create Incident from Case Tab Vụ việc (v0.40) ──────────────────
    describe('auto-create Incident from Case Tab Vụ việc', () => {
      const year = new Date().getFullYear();

      function buildBranch3Tx(caseOverrides: Record<string, any> = {}) {
        return {
          case: { create: jest.fn().mockResolvedValue({ ...mockCase, id: 'new-case-id', ...caseOverrides }) },
          incident: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'auto-inc-id', code: `VV-${year}-00001`, name: mockCase.name }),
            update: jest.fn().mockResolvedValue({}),
          },
          documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
        };
      }

      it('should auto-create when DIRECT_DISCOVERY + incidentDate present', async () => {
        const tx = buildBranch3Tx();
        mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

        const result = await service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'DIRECT_DISCOVERY' as any,
            metadata: { incidentDate: '2026-01-15' } as any,
          },
          'actor-001',
        );

        expect(result.success).toBe(true);
        expect(tx.incident.create).toHaveBeenCalled();
      });

      it('should auto-create when TRANSFERRED + incidentType present', async () => {
        const tx = buildBranch3Tx();
        mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

        const result = await service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'TRANSFERRED' as any,
            metadata: { incidentType: 'Trộm cắp' } as any,
          },
          'actor-001',
        );

        expect(result.success).toBe(true);
        expect(tx.incident.create).toHaveBeenCalled();
      });

      it('should NOT auto-create when Tab Vụ việc is empty (no incident fields)', async () => {
        const tx = buildBranch3Tx();
        mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

        await service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'DIRECT_DISCOVERY' as any,
          },
          'actor-001',
        );

        expect(tx.incident.create).not.toHaveBeenCalled();
      });

      it('should NOT auto-create for FROM_PETITION provenance even with incident fields', async () => {
        const petitionUpdatedAt = new Date('2026-05-22T10:00:00.000Z');
        const existingPetition = { ...mockPetition, id: 'pet-source', linkedCaseId: null, updatedAt: petitionUpdatedAt };
        const incidentCreate = jest.fn();

        mockPrisma.$transaction.mockImplementation(async (fn: any) => {
          const tx = {
            case: { create: jest.fn().mockResolvedValue({ ...mockCase, id: 'new-case-id' }) },
            petition: {
              findFirst: jest.fn().mockResolvedValue(existingPetition),
              update: jest.fn().mockResolvedValue({ ...existingPetition, linkedCaseId: 'new-case-id' }),
            },
            incident: { create: incidentCreate, update: jest.fn() },
            documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
          };
          return fn(tx);
        });

        await service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'FROM_PETITION' as any,
            linkedPetitionId: 'pet-source',
            expectedPetitionUpdatedAt: petitionUpdatedAt.toISOString(),
            metadata: { incidentDate: '2026-01-15' } as any,
          },
          'actor-001',
        );

        expect(incidentCreate).not.toHaveBeenCalled();
      });

      it('should prepend "Vụ việc - " when case name < 5 chars', async () => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue({ ...mockCase, id: 'new-case-id', name: 'AB' }) },
          incident: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'auto-inc-id', code: `VV-${year}-00001`, name: 'Vụ việc - AB' }),
            update: jest.fn().mockResolvedValue({}),
          },
          documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
        };
        mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

        await service.create(
          {
            name: 'AB',
            unit: 'Công an Quận 1',
            caseProvenance: 'DIRECT_DISCOVERY' as any,
            metadata: { incidentDate: '2026-01-15' } as any,
          },
          'actor-001',
        );

        expect(tx.incident.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ name: 'Vụ việc - AB' }),
          }),
        );
      });

      it('should rollback when $transaction callback throws', async () => {
        mockPrisma.$transaction.mockImplementation(async (fn: any) => {
          const tx = {
            case: { create: jest.fn().mockRejectedValue(new Error('DB error')) },
            incident: {
              findFirst: jest.fn().mockResolvedValue(null),
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({ id: 'auto-inc-id', code: `VV-${year}-00001`, name: mockCase.name }),
              update: jest.fn(),
            },
            documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
          };
          return fn(tx);
        });

        await expect(
          service.create(
            {
              ...baseProvenanceDto,
              caseProvenance: 'DIRECT_DISCOVERY' as any,
              metadata: { incidentDate: '2026-01-15' } as any,
            },
            'actor-001',
          ),
        ).rejects.toThrow('DB error');
      });

      it('should set Incident.investigatorId = actorId (scope fix)', async () => {
        const tx = buildBranch3Tx();
        mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

        await service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'DIRECT_DISCOVERY' as any,
            metadata: { incidentDate: '2026-01-15' } as any,
          },
          'actor-001',
        );

        expect(tx.incident.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ investigatorId: 'actor-001' }),
          }),
        );
      });

      it('should set Incident.assignedTeamId from dto (scope fix)', async () => {
        const tx = buildBranch3Tx();
        mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

        await service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'DIRECT_DISCOVERY' as any,
            assignedTeamId: 'team-42',
            metadata: { incidentDate: '2026-01-15' } as any,
          },
          'actor-001',
        );

        expect(tx.incident.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ assignedTeamId: 'team-42' }),
          }),
        );
      });

      it('should set canBoNhapId and createdById = actorId', async () => {
        const tx = buildBranch3Tx();
        mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

        await service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'DIRECT_DISCOVERY' as any,
            metadata: { incidentDate: '2026-01-15' } as any,
          },
          'actor-001',
        );

        expect(tx.incident.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              canBoNhapId: 'actor-001',
              createdById: 'actor-001',
            }),
          }),
        );
      });

      it('should update Incident.linkedCaseId after Case creation', async () => {
        const tx = buildBranch3Tx();
        mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

        await service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'DIRECT_DISCOVERY' as any,
            metadata: { incidentDate: '2026-01-15' } as any,
          },
          'actor-001',
        );

        expect(tx.incident.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'auto-inc-id' },
            data: expect.objectContaining({ linkedCaseId: 'new-case-id' }),
          }),
        );
      });

      it('should emit audit INCIDENT_AUTO_CREATED outside transaction', async () => {
        const tx = buildBranch3Tx();
        mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

        await service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'DIRECT_DISCOVERY' as any,
            metadata: { incidentDate: '2026-01-15' } as any,
          },
          'actor-001',
        );

        expect(mockAudit.log).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'INCIDENT_AUTO_CREATED' }),
        );
      });

      it('should NOT emit audit INCIDENT_AUTO_CREATED when no incident fields', async () => {
        const tx = buildBranch3Tx();
        mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

        await service.create(
          {
            ...baseProvenanceDto,
            caseProvenance: 'DIRECT_DISCOVERY' as any,
          },
          'actor-001',
        );

        expect(mockAudit.log).not.toHaveBeenCalledWith(
          expect.objectContaining({ action: 'INCIDENT_AUTO_CREATED' }),
        );
      });
    });

    // v0.37.2 Contract phase — compat shim removed. Legacy payload now throws 400.
    it('rejects legacy metadata.petitionType payload without caseProvenance (Contract phase)', async () => {
      await expect(
        service.create(
          // Intentionally omit caseProvenance to simulate legacy payload bypassing DTO validation
          {
            ...baseProvenanceDto,
            metadata: { petitionType: 'Tố cáo', reporter: 'Test' },
          } as any,
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);

      // No audit log of legacy receipt — DTO validation rejects upstream of service.
      // (Service-level fallback safety check still throws as defense in depth.)
      expect(mockAudit.log).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PETITION_AUTO_CREATED' }),
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

    // v0.37.2.5: phantom Petition auto-create REMOVED (Đ.143 BLTTHS compliance).
    // BE no longer creates a Petition record from Case.metadata.petitionType when
    // there's no linked Petition. The metadata.petitionType is silently ignored.
    // FE removed petitionType from payload in v0.37.1 — this guards API attack surface.
    it('should NOT create phantom petition when petitionType added and no linked petition exists', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(mockCase);
      mockPrisma.case.update.mockResolvedValue(mockCase);
      mockPrisma.petition.findFirst.mockResolvedValue(null); // No linked petition

      await service.update(
        'case-001',
        { metadata: { petitionType: 'Tố cáo', reporter: 'Test Reporter' } },
        'actor-001',
      );

      // No phantom Petition transaction should fire
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      // No PETITION_AUTO_CREATED audit
      expect(mockAudit.log).not.toHaveBeenCalledWith(
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
        // v0.31.0.2 codex P1 fix: tx.case.findFirst returns _count for in-tx re-check
        // v0.43: linkedIncidents removed from in-tx count (SetNull, not blocker)
        const tx = {
          case: {
            findFirst: jest.fn().mockResolvedValue({
              _count: {
                subjects: baseCase.subjects.length,
                lawyers: baseCase.lawyers.length,
                conclusions: baseCase.conclusions.length,
                documents: baseCase.documents.length,
              },
            }),
            update: jest.fn().mockResolvedValue({ ...baseCase, deletedAt: new Date() }),
          },
          incident: {
            updateMany: jest.fn().mockResolvedValue({ count: (baseCase.linkedIncidents as any[]).length }),
          },
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

    it('BE-6: linkedIncidents không còn là blocker — xóa Case thành công + SetNull INSIDE $transaction', async () => {
      setupBasicCase({ linkedIncidents: [{ id: 'i1' }] });
      // Override $transaction with distinct innerTx to verify writes happen INSIDE transaction
      const innerTx = {
        case: {
          findFirst: jest.fn().mockResolvedValue({
            _count: { subjects: 0, lawyers: 0, conclusions: 0, documents: 0 },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        incident: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (cb: any) => { await cb(innerTx); });
      const result = await service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR);
      expect(result.success).toBe(true);
      // Both writes must be INSIDE the transaction (innerTx, not mockPrisma directly)
      expect(innerTx.incident.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ linkedCaseId: 'case-001' }),
          data: { linkedCaseId: null },
        }),
      );
      expect(innerTx.case.update).toHaveBeenCalled();
    });

    it('BE-6b: Case có linkedIncidentId (Branch-2) — clear Case.linkedIncidentId INSIDE transaction', async () => {
      setupBasicCase({ linkedIncidentId: 'inc-src-001', linkedIncidents: [] });
      const innerTx = {
        case: {
          findFirst: jest.fn().mockResolvedValue({
            _count: { subjects: 0, lawyers: 0, conclusions: 0, documents: 0 },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        incident: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (cb: any) => { await cb(innerTx); });
      const result = await service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR);
      expect(result.success).toBe(true);
      // Clear Case.linkedIncidentId must happen INSIDE the transaction
      expect(innerTx.case.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ linkedIncidentId: null }) }),
      );
      // SetNull incidents also runs (even when empty — unconditional)
      expect(innerTx.incident.updateMany).toHaveBeenCalled();
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

    it('BE-11b: TOCTOU — concurrent subject insert detected in-transaction (codex P1 fix)', async () => {
      // Setup: initial findFirst returns 0 subjects, but in-tx count returns 2
      setupBasicCase();
      mockPrisma.$transaction.mockImplementationOnce(async (cb: any) => {
        const tx = {
          case: {
            findFirst: jest.fn().mockResolvedValue({
              _count: { subjects: 2, lawyers: 0, conclusions: 0, documents: 0 },
            }),
            update: jest.fn(),
          },
          incident: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        await cb(tx);
      });
      await expect(
        service.delete('case-001', REASON, ACTOR_ID, ROLE_NAMES.INVESTIGATOR),
      ).rejects.toThrow(/2 đối tượng.*vừa được thêm/);
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

    it('BE: only counts ACTIVE linked subjects (deletedAt:null filter) + linkedIncidents fetched cho SetNull', async () => {
      setupBasicCase();
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
    it('BE-13a: returns canDelete=true với no blockers; linkedIncidents trong willUnlink (không phải blockers)', async () => {
      mockPrisma.case.findFirst.mockResolvedValue({
        ...mockCase,
        subjects: [], lawyers: [], conclusions: [], documents: [],
        linkedIncidents: [{ id: 'i1', code: 'VV-2026-00001', name: 'Vu viec A' }],
      });
      const result = await service.previewDelete('case-001');
      expect(result.canDelete).toBe(true);
      expect(result.reasonsIfBlocked).toEqual([]);
      // linkedIncidents KHÔNG phải blocker
      expect(result.blockers).toEqual({
        subjects: 0, lawyers: 0, conclusions: 0, documents: 0,
      });
      // linkedIncidents nằm trong willUnlink
      expect(result.willUnlink.incidents).toHaveLength(1);
      expect(result.willUnlink.incidents[0].id).toBe('i1');
    });

    it('BE-13b: returns canDelete=false với linked entities + status reason; linkedIncidents vẫn trong willUnlink', async () => {
      mockPrisma.case.findFirst.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.DANG_DIEU_TRA,
        subjects: [{ id: 's1' }, { id: 's2' }],
        lawyers: [],
        conclusions: [{ id: 'c1' }],
        documents: [],
        linkedIncidents: [{ id: 'i1', code: 'VV-2026-00001', name: 'Vu viec A' }],
      });
      const result = await service.previewDelete('case-001');
      expect(result.canDelete).toBe(false);
      expect(result.blockers.subjects).toBe(2);
      expect(result.blockers.conclusions).toBe(1);
      expect(result.reasonsIfBlocked.length).toBeGreaterThanOrEqual(3); // status + subjects + conclusions
      expect(result.reasonsIfBlocked.some((r) => /Tiếp nhận/.test(r))).toBe(true);
      expect(result.reasonsIfBlocked.some((r) => /2 đối tượng/.test(r))).toBe(true);
      // linkedIncidents không phải reason blocker
      expect(result.reasonsIfBlocked.some((r) => /vụ việc/.test(r))).toBe(false);
      expect(result.willUnlink.incidents).toHaveLength(1);
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
      const withSeverity = { ...mockCase, capDoToiPham: CapDoToiPham.RAT_NGHIEM_TRONG };
      const tx = {
        case: { create: jest.fn().mockResolvedValue(withSeverity) },
        incident: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
        documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-001' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

      const result = await service.create(
        {
          name: 'Vụ án rất nghiêm trọng',
          capDoToiPham: CapDoToiPham.RAT_NGHIEM_TRONG,
          caseProvenance: 'DIRECT_DISCOVERY' as any,
        },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.data.capDoToiPham).toBe(CapDoToiPham.RAT_NGHIEM_TRONG);
      expect(tx.case.create).toHaveBeenCalledWith(
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

    // ── v0.35a: CASE_ESCALATED_FROM_WARD audit (BE-ESC1..3) ─────────────────
    describe('escalation from ward audit (v0.35a)', () => {
      const wardCase = {
        ...existingCase,
        assignedTeamId: 'team-ward-bn',
        assignedTeam: {
          wardId: 'ward-bn',
          ward: { name: 'Phường Bến Nghé' },
        },
      };
      const pc02Team = { id: 'team-pc02-doi1', isActive: true, wardId: null };
      const otherWardTeam = { id: 'team-ward-td', isActive: true, wardId: 'ward-td' };

      it('BE-ESC1: emits CASE_ESCALATED_FROM_WARD when ward team → non-ward (PC02) team', async () => {
        mockPrisma.case.findFirst.mockResolvedValue(wardCase);
        mockPrisma.team.findFirst.mockResolvedValue(pc02Team); // assignment target
        mockPrisma.team.findUnique.mockResolvedValue({ wardId: null }); // escalation check
        mockPrisma.case.update.mockResolvedValue({ ...wardCase, assignedTeamId: 'team-pc02-doi1' });

        await service.assignCase(
          'case-001',
          { assignedTeamId: 'team-pc02-doi1' },
          'dispatcher-001',
        );

        const auditCalls = (mockAudit.log as jest.Mock).mock.calls.map((c) => c[0]);
        const escalation = auditCalls.find((c: any) => c.action === 'CASE_ESCALATED_FROM_WARD');
        expect(escalation).toBeDefined();
        expect(escalation.metadata).toEqual(
          expect.objectContaining({
            oldTeamId: 'team-ward-bn',
            newTeamId: 'team-pc02-doi1',
            oldWardId: 'ward-bn',
            oldWardName: 'Phường Bến Nghé',
          }),
        );
      });

      it('BE-ESC2: does NOT emit FROM_WARD when ward team → another ward team (still ward)', async () => {
        mockPrisma.case.findFirst.mockResolvedValue(wardCase);
        mockPrisma.team.findFirst.mockResolvedValue(otherWardTeam);
        mockPrisma.team.findUnique.mockResolvedValue({ wardId: 'ward-td' });
        mockPrisma.case.update.mockResolvedValue({ ...wardCase, assignedTeamId: 'team-ward-td' });

        await service.assignCase(
          'case-001',
          { assignedTeamId: 'team-ward-td' },
          'dispatcher-001',
        );

        const auditCalls = (mockAudit.log as jest.Mock).mock.calls.map((c) => c[0]);
        const escalation = auditCalls.find((c: any) => c.action === 'CASE_ESCALATED_FROM_WARD');
        expect(escalation).toBeUndefined();
      });

      it('BE-ESC3: does NOT emit FROM_WARD when non-ward team → non-ward team (PC02 internal reassign)', async () => {
        const pc02Case = {
          ...existingCase,
          assignedTeamId: 'team-pc02-old',
          assignedTeam: { wardId: null, ward: null },
        };
        mockPrisma.case.findFirst.mockResolvedValue(pc02Case);
        mockPrisma.team.findFirst.mockResolvedValue(pc02Team);
        mockPrisma.team.findUnique.mockResolvedValue({ wardId: null });
        mockPrisma.case.update.mockResolvedValue({ ...pc02Case, assignedTeamId: 'team-pc02-doi1' });

        await service.assignCase(
          'case-001',
          { assignedTeamId: 'team-pc02-doi1' },
          'dispatcher-001',
        );

        const auditCalls = (mockAudit.log as jest.Mock).mock.calls.map((c) => c[0]);
        const escalation = auditCalls.find((c: any) => c.action === 'CASE_ESCALATED_FROM_WARD');
        expect(escalation).toBeUndefined();
      });
    });
  });

  // ── restore (v0.32.0.0) ─────────────────────────────────────────────────
  describe('restore (v0.32.0.0)', () => {
    const REASON = 'Khôi phục theo yêu cầu của thủ trưởng';
    const ACTOR_ID = 'admin-001';

    const setupDeletedCase = () => {
      const deleted = { ...mockCase, deletedAt: new Date(Date.now() - 24 * 3_600_000) };
      mockPrisma.case.findFirst.mockResolvedValue(deleted);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = { case: { update: jest.fn().mockResolvedValue({ ...deleted, deletedAt: null }) } };
        await cb(tx);
      });
      return deleted;
    };

    it('BE-R1: throws NotFound khi record không tồn tại', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(null);
      await expect(service.restore('nope', REASON, ACTOR_ID)).rejects.toThrow(NotFoundException);
    });

    it('BE-R2: findFirst filter deletedAt:{not:null} — chưa bị xóa thì coi như không tìm thấy', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(null);
      await expect(service.restore('case-001', REASON, ACTOR_ID)).rejects.toThrow(/chưa bị xóa/);
      expect(mockPrisma.case.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-001', deletedAt: { not: null } },
        }),
      );
    });

    it('BE-R3: success — set deletedAt=null + audit CASE_RESTORED với reason', async () => {
      setupDeletedCase();
      const result = await service.restore('case-001', REASON, ACTOR_ID);
      expect(result.success).toBe(true);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CASE_RESTORED',
          metadata: expect.objectContaining({ reason: REASON, hoursAfterDeletion: expect.any(Number) }),
        }),
        expect.anything(),
      );
    });

    it('BE-R4: concurrent restore (P2025) → BadRequest "đã được khôi phục"', async () => {
      setupDeletedCase();
      const p2025 = new Prisma.PrismaClientKnownRequestError(
        'Record to update not found',
        { code: 'P2025', clientVersion: '7.8.0' },
      );
      mockPrisma.$transaction.mockRejectedValueOnce(p2025);
      await expect(service.restore('case-001', REASON, ACTOR_ID)).rejects.toThrow(/đã được khôi phục/);
    });
  });

  // ── listDeleted (v0.32.0.0) ─────────────────────────────────────────────
  describe('listDeleted (v0.32.0.0)', () => {
    it('BE-R5: returns paginated với deleteAudit enriched', async () => {
      const deleted = { ...mockCase, deletedAt: new Date() };
      mockPrisma.case.findMany.mockResolvedValue([deleted]);
      mockPrisma.case.count.mockResolvedValue(1);
      (mockPrisma as any).$queryRaw = jest.fn().mockResolvedValue([
        { subjectId: 'case-001', userId: 'u1', metadata: { reason: 'Test xóa' }, createdAt: new Date() },
      ]);
      const result = await service.listDeleted({ limit: 20, offset: 0 });
      expect(result.success).toBe(true);
      expect(result.total).toBe(1);
      expect(result.data[0].deleteAudit).toBeTruthy();
      expect(result.data[0].deleteAudit?.metadata).toMatchObject({ reason: 'Test xóa' });
    });

    it('BE-R6: search filter applied', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);
      mockPrisma.case.count.mockResolvedValue(0);
      (mockPrisma as any).$queryRaw = jest.fn().mockResolvedValue([]);
      await service.listDeleted({ search: 'tham nhũng' });
      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: { not: null },
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: 'tham nhũng', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });
  });
});
