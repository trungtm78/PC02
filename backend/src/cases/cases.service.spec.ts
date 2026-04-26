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
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CaseStatus, PetitionStatus, CapDoToiPham } from '@prisma/client';

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

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
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

      await service.getList({ overdue: 'true' });

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

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should soft delete case', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(mockCase);
      mockPrisma.case.update.mockResolvedValue({
        ...mockCase,
        deletedAt: new Date(),
      });

      const result = await service.delete('case-001', 'actor-001');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Xóa');
      expect(mockPrisma.case.update).toHaveBeenCalledWith({
        where: { id: 'case-001' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASE_DELETED' }),
      );
    });

    it('should throw NotFoundException when deleting non-existent case', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('nonexistent', 'actor-001'),
      ).rejects.toThrow(NotFoundException);
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
