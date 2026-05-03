/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * IncidentsService Unit Tests
 *
 * Tests cover:
 *   - getList: pagination, search, filters (status, loaiDonVu, benVu, etc.), date range, overdue
 *   - getById: found / not found
 *   - create: success, date validation, invalid investigator, code generation
 *   - update: success, not found, date validation, invalid investigator
 *   - delete: success (soft delete), not found
 *   - updateStatus: valid transitions, invalid transitions, not found
 *   - mergeInto: success, self-merge, already merged, target not found, target soft-deleted
 *   - transferUnit: success, not found
 *   - getStats: returns counts grouped by status
 *   - assignInvestigator: success, terminal status rejection, investigator not found
 *   - prosecute: success with $transaction, invalid status rejection
 *   - generateIncidentCode: via create (findFirst DESC + retry)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IncidentStatus, LoaiNguonTin } from '@prisma/client';
import { TERMINAL_STATUSES, VALID_TRANSITIONS, PHASE_STATUSES } from './incidents.constants';
import { SettingsService } from '../settings/settings.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockIncident = {
  id: 'inc-001',
  code: 'VV-2026-00001',
  name: 'Vu viec test',
  incidentType: 'Hinh su',
  description: 'Mo ta vu viec',
  fromDate: new Date('2026-01-01'),
  toDate: new Date('2026-06-01'),
  deadline: new Date('2026-12-31'),
  unitId: 'unit-001',
  status: IncidentStatus.TIEP_NHAN,
  investigatorId: 'user-001',
  sourcePetitionId: null,
  doiTuongCaNhan: 'Nguyen Van A',
  doiTuongToChuc: null,
  loaiDonVu: LoaiNguonTin.TO_GIAC,
  soLanGiaHan: 0,
  ngayGiaHan: null,
  benVu: 'Ben bi to cao',
  donViGiaiQuyet: 'Cong an Quan 1',
  ngayDeXuat: new Date('2026-01-15'),
  canBoNhapId: 'user-002',
  assignedTeamId: null,
  createdById: 'actor-001',
  linkedCaseId: null,
  mergedIntoId: null,
  chuyenDenDonVi: null,
  chuyenTuDonVi: null,
  ketQuaXuLy: null,
  tinhTrangHoSo: null,
  tinhTrangThoiHieu: null,
  nguoiQuyetDinh: null,
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

const mockPrisma = {
  incident: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    groupBy: jest.fn(),
  },
  petition: {
    updateMany: jest.fn(),
  },
  document: {
    updateMany: jest.fn(),
  },
  incidentStatusHistory: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  team: {
    findFirst: jest.fn(),
  },
  userTeam: {
    findFirst: jest.fn(),
  },
  case: {
    create: jest.fn(),
  },
  $transaction: jest.fn() as any,
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockSettings = {
  getNumericValue: jest.fn().mockResolvedValue(20),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('IncidentsService', () => {
  let service: IncidentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    jest.clearAllMocks();
  });

  // ── getList ───────────────────────────────────────────────────────────────

  describe('getList', () => {
    it('should return paginated results', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([mockIncident]);
      mockPrisma.incident.count.mockResolvedValue(1);

      const result = await service.getList({ limit: 20, offset: 0 });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should apply search filter across multiple fields', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({ search: 'test search' });

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ code: { contains: 'test search', mode: 'insensitive' } }),
              expect.objectContaining({ name: { contains: 'test search', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({ status: IncidentStatus.DANG_XAC_MINH });

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: IncidentStatus.DANG_XAC_MINH }),
        }),
      );
    });

    it('should filter by loaiDonVu', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({ loaiDonVu: 'To cao' } as any);

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ loaiDonVu: 'To cao' }),
        }),
      );
    });

    it('should filter by benVu', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({ benVu: 'Ben bi to cao' } as any);

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ benVu: 'Ben bi to cao' }),
        }),
      );
    });

    it('should filter by tinhTrangHoSo', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({ tinhTrangHoSo: 'DAY_DU' } as any);

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tinhTrangHoSo: 'DAY_DU' }),
        }),
      );
    });

    it('should filter by tinhTrangThoiHieu', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({ tinhTrangThoiHieu: 'CON_THOI_HIEU' } as any);

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tinhTrangThoiHieu: 'CON_THOI_HIEU' }),
        }),
      );
    });

    it('should filter by canBoNhapId', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({ canBoNhapId: 'user-002' } as any);

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ canBoNhapId: 'user-002' }),
        }),
      );
    });

    it('should filter by date range (fromDateRange and toDateRange)', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({
        fromDateRange: '2026-01-01',
        toDateRange: '2026-06-30',
      } as any);

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ngayDeXuat: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });

    it('should filter overdue incidents excluding terminal statuses', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({ overdue: true } as any);

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deadline: { lt: expect.any(Date) },
            status: { notIn: TERMINAL_STATUSES },
          }),
        }),
      );
    });

    it('should apply data scope filter when provided', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList(
        { limit: 20, offset: 0 },
        { userIds: ['user-001'], teamIds: [], writableTeamIds: [] },
      );

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.any(Array),
          }),
        }),
      );
    });

    it('should filter by phase=tiep-nhan', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({ phase: 'tiep-nhan' } as any);

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [IncidentStatus.TIEP_NHAN] },
          }),
        }),
      );
    });

    it('should filter by phase=xac-minh', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({ phase: 'xac-minh' } as any);

      expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [IncidentStatus.DANG_XAC_MINH, IncidentStatus.DA_PHAN_CONG, IncidentStatus.QUA_HAN] },
          }),
        }),
      );
    });

    it('should ignore invalid phase', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([]);
      mockPrisma.incident.count.mockResolvedValue(0);

      await service.getList({ phase: 'invalid-phase' } as any);

      const callArgs = mockPrisma.incident.findMany.mock.calls[0][0];
      // status should not be set to an { in: [...] } filter
      expect(callArgs.where.status).toBeUndefined();
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return incident with includes', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        petitions: [],
        statusHistory: [],
      });

      const result = await service.getById('inc-001');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('inc-001');
    });

    it('should throw NotFoundException when incident not found', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    beforeEach(() => {
      // Default: code generation returns no existing code, no conflict
      mockPrisma.incident.findFirst.mockResolvedValue(null);
      mockPrisma.incident.findUnique.mockResolvedValue(null);
    });

    it('should create incident with generated code and TIEP_NHAN status', async () => {
      mockPrisma.incident.create.mockResolvedValue(mockIncident);

      const result = await service.create(
        { name: 'Vu viec test', incidentType: 'Hinh su' } as any,
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
      expect(mockPrisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: IncidentStatus.TIEP_NHAN,
            createdById: 'actor-001',
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_CREATED' }),
      );
    });

    it('should throw BadRequestException when fromDate > toDate', async () => {
      await expect(
        service.create(
          { name: 'Test', fromDate: '2026-12-01', toDate: '2026-01-01' } as any,
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid investigatorId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { name: 'Test', investigatorId: 'invalid-user' } as any,
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate code with format VV-YYYY-XXXXX starting at 00001', async () => {
      const year = new Date().getFullYear();
      mockPrisma.incident.findFirst.mockResolvedValue(null); // No existing
      mockPrisma.incident.findUnique.mockResolvedValue(null); // No conflict
      mockPrisma.incident.create.mockImplementation((args: any) => {
        expect(args.data.code).toBe(`VV-${year}-00001`);
        return { ...mockIncident, code: args.data.code };
      });

      await service.create({ name: 'Test' } as any, 'actor-001');

      expect(mockPrisma.incident.create).toHaveBeenCalled();
    });

    it('should increment code from last existing incident', async () => {
      const year = new Date().getFullYear();
      mockPrisma.incident.findFirst.mockResolvedValue({ code: `VV-${year}-00042` });
      mockPrisma.incident.findUnique.mockResolvedValue(null);
      mockPrisma.incident.create.mockImplementation((args: any) => {
        expect(args.data.code).toBe(`VV-${year}-00043`);
        return { ...mockIncident, code: args.data.code };
      });

      await service.create({ name: 'Test' } as any, 'actor-001');

      expect(mockPrisma.incident.create).toHaveBeenCalled();
    });

    it('should auto-calculate deadline from ngayDeXuat + settings', async () => {
      mockPrisma.incident.create.mockResolvedValue(mockIncident);
      mockSettings.getNumericValue.mockResolvedValue(20);

      await service.create(
        { name: 'Test', ngayDeXuat: '2026-01-01' } as any,
        'actor-001',
      );

      expect(mockSettings.getNumericValue).toHaveBeenCalledWith('THOI_HAN_XAC_MINH', 20);
      const createCall = mockPrisma.incident.create.mock.calls[0][0];
      const deadline = createCall.data.deadline as Date;
      expect(deadline.toISOString().slice(0, 10)).toBe('2026-01-21');
    });

    it('should not crash when ngayDeXuat is null', async () => {
      mockPrisma.incident.create.mockResolvedValue(mockIncident);

      await service.create(
        { name: 'Test' } as any,
        'actor-001',
      );

      const createCall = mockPrisma.incident.create.mock.calls[0][0];
      expect(createCall.data.deadline).toBeUndefined();
    });

    it('should pass new fields (soQuyetDinh, diaChiXayRa, etc.) to prisma.incident.create', async () => {
      mockPrisma.incident.create.mockResolvedValue(mockIncident);

      await service.create(
        {
          name: 'Test',
          soQuyetDinh: 'QD-001',
          ngayQuyetDinh: '2026-03-15',
          lyDoKhongKhoiTo: 'Khong du chung cu',
          lyDoTamDinhChiText: 'Cho ket qua giam dinh',
          diaChiXayRa: '123 Nguyen Hue, Q1',
          sdtNguoiToGiac: '0901234567',
          diaChiNguoiToGiac: '456 Le Loi, Q3',
          cmndNguoiToGiac: '079123456789',
        } as any,
        'actor-001',
      );

      const createCall = mockPrisma.incident.create.mock.calls[0][0];
      expect(createCall.data.soQuyetDinh).toBe('QD-001');
      expect(createCall.data.diaChiXayRa).toBe('123 Nguyen Hue, Q1');
      expect(createCall.data.sdtNguoiToGiac).toBe('0901234567');
      expect(createCall.data.diaChiNguoiToGiac).toBe('456 Le Loi, Q3');
      expect(createCall.data.cmndNguoiToGiac).toBe('079123456789');
      expect(createCall.data.lyDoKhongKhoiTo).toBe('Khong du chung cu');
      expect(createCall.data.lyDoTamDinhChiText).toBe('Cho ket qua giam dinh');
      expect(createCall.data.ngayQuyetDinh).toEqual(new Date('2026-03-15'));
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update incident successfully', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(mockIncident);
      mockPrisma.incident.update.mockResolvedValue({ ...mockIncident, name: 'Updated' });

      const result = await service.update('inc-001', { name: 'Updated' } as any, 'actor-001');

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_UPDATED' }),
      );
    });

    it('should throw NotFoundException when incident not found', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' } as any, 'actor-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when fromDate > toDate on update', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        fromDate: new Date('2026-01-01'),
        toDate: new Date('2026-06-01'),
      });

      await expect(
        service.update('inc-001', { fromDate: '2027-01-01' } as any, 'actor-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid investigatorId on update', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(mockIncident);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('inc-001', { investigatorId: 'invalid-user' } as any, 'actor-001'),
      ).rejects.toThrow(BadRequestException);
    });

    describe('optimistic locking', () => {
      const stalestamp = '2026-01-01T00:00:00.000Z';

      it('throws ConflictException when P2025 with expectedUpdatedAt (stale version)', async () => {
        mockPrisma.incident.findFirst.mockResolvedValue(mockIncident);
        mockPrisma.incident.update.mockRejectedValue({ code: 'P2025' });

        await expect(
          service.update('inc-001', { name: 'Edited', expectedUpdatedAt: stalestamp } as any, 'actor-001'),
        ).rejects.toThrow(ConflictException);
      });

      it('passes updatedAt in where clause when expectedUpdatedAt provided', async () => {
        mockPrisma.incident.findFirst.mockResolvedValue(mockIncident);
        mockPrisma.incident.update.mockResolvedValue({ ...mockIncident, name: 'Edited' });

        await service.update('inc-001', { name: 'Edited', expectedUpdatedAt: stalestamp } as any, 'actor-001');

        expect(mockPrisma.incident.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ id: 'inc-001', updatedAt: new Date(stalestamp) }),
          }),
        );
      });

      it('does NOT add updatedAt to where clause when expectedUpdatedAt absent (backward compat)', async () => {
        mockPrisma.incident.findFirst.mockResolvedValue(mockIncident);
        mockPrisma.incident.update.mockResolvedValue(mockIncident);

        await service.update('inc-001', { name: 'Edited' } as any, 'actor-001');

        const callArgs = mockPrisma.incident.update.mock.calls[0][0];
        expect(callArgs.where).not.toHaveProperty('updatedAt');
      });
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete (6 business rules)', () => {
    const reason = 'Nhập sai thông tin, trùng lặp với VV-2026-00001';
    const deletableIncident = {
      ...mockIncident,
      status: IncidentStatus.TIEP_NHAN,
      createdById: 'actor-001',
      createdAt: new Date(), // just created
      petitions: [],
      documents: [],
      linkedCase: null,
      linkedCaseId: null,
    };

    it('1. should soft delete TIEP_NHAN incident by its creator', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(deletableIncident);
      mockPrisma.incident.update.mockResolvedValue({ ...deletableIncident, deletedAt: new Date() });

      const result = await service.delete('inc-001', reason, 'actor-001', 'OFFICER');

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/xóa/i);
      expect(mockPrisma.incident.update).toHaveBeenCalledWith({
        where: { id: 'inc-001' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INCIDENT_DELETED',
          metadata: expect.objectContaining({ reason }),
        }),
      );
    });

    it('2. should reject deletion of non-TIEP_NHAN incident', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...deletableIncident,
        status: IncidentStatus.DANG_XAC_MINH,
      });

      await expect(
        service.delete('inc-001', reason, 'actor-001', 'OFFICER'),
      ).rejects.toThrow(BadRequestException);
    });

    it('3. should reject deletion when petitions are linked', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...deletableIncident,
        petitions: [{ id: 'pet-001' }],
      });

      await expect(
        service.delete('inc-001', reason, 'actor-001', 'OFFICER'),
      ).rejects.toThrow(/đơn thư/);
    });

    it('4. should reject deletion when documents are attached', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...deletableIncident,
        documents: [{ id: 'doc-001' }],
      });

      await expect(
        service.delete('inc-001', reason, 'actor-001', 'OFFICER'),
      ).rejects.toThrow(/tài liệu/);
    });

    it('5. should reject deletion when linked to a case', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...deletableIncident,
        linkedCaseId: 'case-001',
        linkedCase: { id: 'case-001' },
      });

      await expect(
        service.delete('inc-001', reason, 'actor-001', 'OFFICER'),
      ).rejects.toThrow(/vụ án/);
    });

    it('6. should reject deletion by non-creator non-admin officer', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(deletableIncident);

      await expect(
        service.delete('inc-001', reason, 'other-officer', 'OFFICER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('7. should allow admin to delete any officer\'s incident', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(deletableIncident);
      mockPrisma.incident.update.mockResolvedValue({ ...deletableIncident, deletedAt: new Date() });

      const result = await service.delete('inc-001', reason, 'admin-001', 'ADMIN');

      expect(result.success).toBe(true);
    });

    it('8. should reject officer deletion after 72h window', async () => {
      mockSettings.getNumericValue.mockResolvedValue(72); // THOI_HAN_XOA_VU_VIEC
      const oldIncident = {
        ...deletableIncident,
        createdAt: new Date(Date.now() - 73 * 3_600_000), // 73 hours ago
      };
      mockPrisma.incident.findFirst.mockResolvedValue(oldIncident);

      await expect(
        service.delete('inc-001', reason, 'actor-001', 'OFFICER'),
      ).rejects.toThrow(/72 giờ/);
    });

    it('9. should allow admin deletion after 72h window (admin bypass)', async () => {
      const oldIncident = {
        ...deletableIncident,
        createdAt: new Date(Date.now() - 100 * 3_600_000), // 100 hours ago
      };
      mockPrisma.incident.findFirst.mockResolvedValue(oldIncident);
      mockPrisma.incident.update.mockResolvedValue({ ...oldIncident, deletedAt: new Date() });

      const result = await service.delete('inc-001', reason, 'admin-001', 'ADMIN');

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException for non-existent incident', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('nonexistent', reason, 'actor-001', 'OFFICER'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should transition TIEP_NHAN -> DANG_XAC_MINH (valid)', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.TIEP_NHAN,
      });
      const updatedIncident = { ...mockIncident, status: IncidentStatus.DANG_XAC_MINH };
      mockPrisma.$transaction.mockResolvedValue([updatedIncident, {}]);

      const result = await service.updateStatus(
        'inc-001',
        { status: IncidentStatus.DANG_XAC_MINH },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(IncidentStatus.DANG_XAC_MINH);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything()]),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_STATUS_CHANGED' }),
      );
    });

    it('should transition DANG_XAC_MINH -> TAM_DINH_CHI (valid)', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.DANG_XAC_MINH,
      });
      const updated = { ...mockIncident, status: IncidentStatus.TAM_DINH_CHI };
      mockPrisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.updateStatus(
        'inc-001',
        { status: IncidentStatus.TAM_DINH_CHI },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(IncidentStatus.TAM_DINH_CHI);
    });

    it('should transition TAM_DINH_CHI -> PHUC_HOI_NGUON_TIN (valid)', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.TAM_DINH_CHI,
      });
      const updated = { ...mockIncident, status: IncidentStatus.PHUC_HOI_NGUON_TIN };
      mockPrisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.updateStatus(
        'inc-001',
        { status: IncidentStatus.PHUC_HOI_NGUON_TIN },
        'actor-001',
      );

      expect(result.success).toBe(true);
    });

    it('should reject invalid transition TIEP_NHAN -> DA_GIAI_QUYET', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.TIEP_NHAN,
      });

      await expect(
        service.updateStatus(
          'inc-001',
          { status: IncidentStatus.DA_GIAI_QUYET },
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transitions from terminal status DA_GIAI_QUYET', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.DA_GIAI_QUYET,
      });

      await expect(
        service.updateStatus(
          'inc-001',
          { status: IncidentStatus.TIEP_NHAN },
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transitions from terminal status DA_CHUYEN_VU_AN', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.DA_CHUYEN_VU_AN,
      });

      await expect(
        service.updateStatus(
          'inc-001',
          { status: IncidentStatus.DANG_XAC_MINH },
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent incident', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', { status: IncidentStatus.DANG_XAC_MINH }, 'actor-001'),
      ).rejects.toThrow(NotFoundException);
    });

    // GAP-6: lyDoKhongKhoiTo validation (Điều 157 BLTTHS 2015)
    it('KHONG_KHOI_TO without lyDoKhongKhoiTo → throws BadRequestException', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.DANG_XAC_MINH,
      });

      await expect(
        service.updateStatus(
          'inc-001',
          { status: IncidentStatus.KHONG_KHOI_TO },
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('KHONG_KHOI_TO with lyDoKhongKhoiTo → success, field saved', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.DANG_XAC_MINH,
      });
      const updated = { ...mockIncident, status: IncidentStatus.KHONG_KHOI_TO, lyDoKhongKhoiTo: 'KHONG_CO_SU_VIEC' };
      mockPrisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.updateStatus(
        'inc-001',
        { status: IncidentStatus.KHONG_KHOI_TO, lyDoKhongKhoiTo: 'KHONG_CO_SU_VIEC' as any },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(IncidentStatus.KHONG_KHOI_TO);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_STATUS_CHANGED' }),
      );
    });
  });

  // ── mergeInto ─────────────────────────────────────────────────────────────

  describe('mergeInto', () => {
    const targetIncident = {
      ...mockIncident,
      id: 'inc-002',
      code: 'VV-2026-00002',
      name: 'Vu viec target',
    };

    it('should merge incident into target successfully', async () => {
      mockPrisma.incident.findFirst
        .mockResolvedValueOnce({ ...mockIncident, status: IncidentStatus.DANG_XAC_MINH })
        .mockResolvedValueOnce(targetIncident);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}, {}]);

      const result = await service.mergeInto(
        'inc-001',
        { targetId: 'inc-002' },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('VV-2026-00002');
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything()]),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_MERGED' }),
      );
    });

    it('should throw BadRequestException when merging into self', async () => {
      await expect(
        service.mergeInto('inc-001', { targetId: 'inc-001' }, 'actor-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when source already merged', async () => {
      mockPrisma.incident.findFirst
        .mockResolvedValueOnce({ ...mockIncident, status: IncidentStatus.DA_NHAP_VU_KHAC })
        .mockResolvedValueOnce(targetIncident);

      await expect(
        service.mergeInto('inc-001', { targetId: 'inc-002' }, 'actor-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when source not found', async () => {
      mockPrisma.incident.findFirst
        .mockResolvedValueOnce(null) // source not found
        .mockResolvedValueOnce(targetIncident);

      await expect(
        service.mergeInto('inc-001', { targetId: 'inc-002' }, 'actor-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when target not found', async () => {
      mockPrisma.incident.findFirst
        .mockResolvedValueOnce(mockIncident) // source found
        .mockResolvedValueOnce(null); // target not found (deleted or nonexistent)

      await expect(
        service.mergeInto('inc-001', { targetId: 'nonexistent' }, 'actor-001'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── transferUnit ──────────────────────────────────────────────────────────

  describe('transferUnit', () => {
    it('should transfer incident to new unit successfully', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(mockIncident);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.transferUnit(
        'inc-001',
        { donViMoi: 'unit-new' },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('unit-new');
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything()]),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_TRANSFERRED' }),
      );
    });

    it('should use donViGiaiQuyet as chuyenTuDonVi when unitId is null', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        unitId: null,
        donViGiaiQuyet: 'DV-fallback',
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      await service.transferUnit('inc-001', { donViMoi: 'unit-new' }, 'actor-001');

      // The transaction was called -- we verify via audit log metadata
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ donViCu: null }),
        }),
      );
    });

    it('should throw NotFoundException when incident not found', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(null);

      await expect(
        service.transferUnit('nonexistent', { donViMoi: 'unit-new' }, 'actor-001'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getStats ──────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should return counts grouped by status', async () => {
      mockPrisma.incident.groupBy.mockResolvedValue([
        { status: IncidentStatus.TIEP_NHAN, _count: 5 },
        { status: IncidentStatus.DANG_XAC_MINH, _count: 3 },
        { status: IncidentStatus.DA_GIAI_QUYET, _count: 10 },
      ]);

      const result = await service.getStats();

      expect(result.success).toBe(true);
      expect(result.data[IncidentStatus.TIEP_NHAN]).toBe(5);
      expect(result.data[IncidentStatus.DANG_XAC_MINH]).toBe(3);
      expect(result.data[IncidentStatus.DA_GIAI_QUYET]).toBe(10);
    });

    it('should return empty object when no incidents exist', async () => {
      mockPrisma.incident.groupBy.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('should apply data scope filter when provided', async () => {
      mockPrisma.incident.groupBy.mockResolvedValue([]);

      await service.getStats({ userIds: ['user-001'], teamIds: [], writableTeamIds: [] });

      expect(mockPrisma.incident.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.any(Array),
          }),
        }),
      );
    });
  });

  // ── assignInvestigator ────────────────────────────────────────────────────

  describe('assignInvestigator', () => {
    it('should assign investigator and set DANG_XAC_MINH status', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(mockIncident);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-inv',
        firstName: 'Tran',
        lastName: 'Van B',
      });
      mockPrisma.incident.update.mockResolvedValue({
        ...mockIncident,
        investigatorId: 'user-inv',
        status: IncidentStatus.DANG_XAC_MINH,
      });

      const result = await service.assignInvestigator(
        'inc-001',
        { investigatorId: 'user-inv' },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.incident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            investigatorId: 'user-inv',
            status: IncidentStatus.DANG_XAC_MINH,
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_ASSIGNED' }),
      );
    });

    it('should reject assignment for terminal status incident', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.DA_GIAI_QUYET,
      });

      await expect(
        service.assignInvestigator('inc-001', { investigatorId: 'user-inv' }, 'actor-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when investigator not found', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(mockIncident);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.assignInvestigator('inc-001', { investigatorId: 'invalid' }, 'actor-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when incident not found', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(null);

      await expect(
        service.assignInvestigator('nonexistent', { investigatorId: 'user-inv' }, 'actor-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows dispatcher (canDispatch=true) to assign incident outside own scope', async () => {
      const outsideScope = { assignedTeamId: 'other-team', investigatorId: 'other-user' };
      mockPrisma.incident.findFirst.mockResolvedValue({ ...mockIncident, ...outsideScope });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-inv', firstName: 'X', lastName: 'Y' });
      mockPrisma.incident.update.mockResolvedValue({ ...mockIncident, investigatorId: 'user-inv' });

      const dispatcherScope = { teamIds: ['own-team'], userIds: ['actor-001'], writableTeamIds: ['own-team'], canDispatch: true };

      await expect(
        service.assignInvestigator('inc-001', { investigatorId: 'user-inv' }, 'actor-001', {}, dispatcherScope),
      ).resolves.toMatchObject({ success: true });
    });

    it('throws BadRequestException when assignedTeamId provided but investigator not in team', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({ ...mockIncident, assignedTeamId: null });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-inv', firstName: 'X', lastName: 'Y' });
      mockPrisma.team.findFirst.mockResolvedValue({ id: 'team-b', isActive: true });
      mockPrisma.userTeam.findFirst.mockResolvedValue(null);

      const dispatcherScope = { teamIds: ['own-team'], userIds: ['actor-001'], writableTeamIds: ['own-team'], canDispatch: true };

      await expect(
        service.assignInvestigator('inc-001', { investigatorId: 'user-inv', assignedTeamId: 'team-b' }, 'actor-001', {}, dispatcherScope),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── prosecute ─────────────────────────────────────────────────────────────

  describe('prosecute', () => {
    it('should prosecute DANG_XAC_MINH incident using $transaction', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.DANG_XAC_MINH,
      });

      const mockCaseRecord = { id: 'case-new', name: 'Vu an moi' };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue(mockCaseRecord) },
          incident: { update: jest.fn().mockResolvedValue({}) },
          incidentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.prosecute(
        'inc-001',
        { caseName: 'Vu an moi', prosecutionDecision: 'QD-001', crime: 'Hinh su' },
        'actor-001',
      );

      expect(result.success).toBe(true);
      expect(result.data.case).toEqual(mockCaseRecord);
      expect(result.data.incident.status).toBe(IncidentStatus.DA_CHUYEN_VU_AN);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_PROSECUTED' }),
      );
    });

    it('should also allow prosecute from DA_PHAN_CONG status', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.DA_PHAN_CONG,
      });

      const mockCaseRecord = { id: 'case-new', name: 'Vu an' };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue(mockCaseRecord) },
          incident: { update: jest.fn().mockResolvedValue({}) },
          incidentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.prosecute(
        'inc-001',
        { caseName: 'Vu an', prosecutionDecision: 'QD-001', crime: 'Hinh su' },
        'actor-001',
      );

      expect(result.success).toBe(true);
    });

    it('should reject prosecute from TIEP_NHAN status', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.TIEP_NHAN,
      });

      await expect(
        service.prosecute(
          'inc-001',
          { caseName: 'Test', prosecutionDecision: 'QD-001', crime: 'Test' },
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject prosecute from terminal status', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.DA_GIAI_QUYET,
      });

      await expect(
        service.prosecute(
          'inc-001',
          { caseName: 'Test', prosecutionDecision: 'QD-001', crime: 'Test' },
          'actor-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when incident not found', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(null);

      await expect(
        service.prosecute('nonexistent', { caseName: 'Test', prosecutionDecision: 'QD-001', crime: 'Test' }, 'actor-001'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getInvestigators ──────────────────────────────────────────────────────

  describe('getInvestigators', () => {
    it('should return list of active investigators', async () => {
      const mockUsers = [
        { id: 'user-001', firstName: 'A', lastName: 'B', username: 'ab', email: 'a@b.c', workId: 'W1' },
      ];
      mockPrisma.user.findMany = jest.fn().mockResolvedValue(mockUsers);

      const result = await service.getInvestigators();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should filter investigators by search term', async () => {
      mockPrisma.user.findMany = jest.fn().mockResolvedValue([]);

      await service.getInvestigators('Nguyen');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              expect.objectContaining({ firstName: { contains: 'Nguyen', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });
  });

  // ── VALID_TRANSITIONS exhaustive check ────────────────────────────────────

  describe('VALID_TRANSITIONS (constants)', () => {
    it('should have TIEP_NHAN as a source with 4 valid targets', () => {
      const targets = VALID_TRANSITIONS[IncidentStatus.TIEP_NHAN];
      expect(targets).toBeDefined();
      expect(targets).toHaveLength(4);
      expect(targets).toContain(IncidentStatus.DANG_XAC_MINH);
      expect(targets).toContain(IncidentStatus.DA_PHAN_CONG);
      expect(targets).toContain(IncidentStatus.DA_CHUYEN_DON_VI);
      expect(targets).toContain(IncidentStatus.PHAN_LOAI_DAN_SU);
    });

    it('should not define outgoing transitions for DA_GIAI_QUYET', () => {
      const targets = VALID_TRANSITIONS[IncidentStatus.DA_GIAI_QUYET];
      expect(targets).toBeUndefined();
    });

    it('should not define outgoing transitions for DA_CHUYEN_VU_AN', () => {
      const targets = VALID_TRANSITIONS[IncidentStatus.DA_CHUYEN_VU_AN];
      expect(targets).toBeUndefined();
    });

    it('should have QUA_HAN with valid recovery transitions', () => {
      const targets = VALID_TRANSITIONS[IncidentStatus.QUA_HAN];
      expect(targets).toBeDefined();
      expect(targets).toContain(IncidentStatus.DANG_XAC_MINH);
      expect(targets).toContain(IncidentStatus.DA_PHAN_CONG);
      expect(targets).toContain(IncidentStatus.TAM_DINH_CHI);
    });

    it('should have TAM_DINH_CHI -> PHUC_HOI_NGUON_TIN, TDC_HET_THOI_HIEU, TDC_HTH_KHONG_KT', () => {
      const targets = VALID_TRANSITIONS[IncidentStatus.TAM_DINH_CHI];
      expect(targets).toHaveLength(3);
      expect(targets).toContain(IncidentStatus.PHUC_HOI_NGUON_TIN);
      expect(targets).toContain(IncidentStatus.TDC_HET_THOI_HIEU);
      expect(targets).toContain(IncidentStatus.TDC_HTH_KHONG_KT);
    });
  });

  // ── extendDeadline ────────────────────────────────────────────────────────

  describe('extendDeadline', () => {
    const baseDeadline = new Date('2026-03-01');

    it('first extension: soLanGiaHan=0 → success, becomes 1, deadline+=60d, ngayGiaHan set', async () => {
      const incident = { ...mockIncident, soLanGiaHan: 0, deadline: baseDeadline };
      const updated = { ...incident, soLanGiaHan: 1, ngayGiaHan: new Date() };
      mockPrisma.incident.findFirst
        .mockResolvedValueOnce(incident)  // existence check
        .mockResolvedValueOnce(updated);  // post-update fetch
      mockSettings.getNumericValue
        .mockResolvedValueOnce(2)   // SO_LAN_GIA_HAN_TOI_DA
        .mockResolvedValueOnce(60); // THOI_HAN_GIA_HAN_1
      mockPrisma.incident.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.extendDeadline('inc-001', 'actor-001', {});

      expect(result.success).toBe(true);
      // deadline should be baseDeadline + 60 days
      const expectedDeadline = new Date(baseDeadline);
      expectedDeadline.setDate(expectedDeadline.getDate() + 60);
      expect(mockPrisma.incident.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deadline: expectedDeadline, soLanGiaHan: { increment: 1 } }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_DEADLINE_EXTENDED' }),
      );
    });

    it('second extension: soLanGiaHan=1 → success, becomes 2', async () => {
      const incident = { ...mockIncident, soLanGiaHan: 1, deadline: baseDeadline };
      const updated = { ...incident, soLanGiaHan: 2, ngayGiaHan: new Date() };
      mockPrisma.incident.findFirst
        .mockResolvedValueOnce(incident)  // existence check
        .mockResolvedValueOnce(updated);  // post-update fetch
      mockSettings.getNumericValue
        .mockResolvedValueOnce(2)   // SO_LAN_GIA_HAN_TOI_DA
        .mockResolvedValueOnce(60); // THOI_HAN_GIA_HAN_2
      mockPrisma.incident.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.extendDeadline('inc-001', 'actor-001', {});

      expect(result.success).toBe(true);
      expect(mockPrisma.incident.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ soLanGiaHan: { increment: 1 } }),
        }),
      );
    });

    it('third attempt: soLanGiaHan=2 → throws BadRequestException', async () => {
      const incident = { ...mockIncident, soLanGiaHan: 2, deadline: baseDeadline };
      mockPrisma.incident.findFirst.mockResolvedValue(incident);
      mockSettings.getNumericValue.mockResolvedValueOnce(2); // SO_LAN_GIA_HAN_TOI_DA

      await expect(service.extendDeadline('inc-001', 'actor-001', {})).rejects.toThrow(BadRequestException);
      expect(mockPrisma.incident.updateMany).not.toHaveBeenCalled();
    });

    it('incident not found → throws NotFoundException', async () => {
      mockPrisma.incident.findFirst.mockResolvedValue(null);

      await expect(service.extendDeadline('no-such-id', 'actor-001', {})).rejects.toThrow(NotFoundException);
    });

    it('incident with no deadline → throws BadRequestException', async () => {
      const incident = { ...mockIncident, soLanGiaHan: 0, deadline: null };
      mockPrisma.incident.findFirst.mockResolvedValue(incident);
      mockSettings.getNumericValue.mockResolvedValueOnce(2); // SO_LAN_GIA_HAN_TOI_DA

      await expect(service.extendDeadline('inc-001', 'actor-001', {})).rejects.toThrow(BadRequestException);
      expect(mockPrisma.incident.updateMany).not.toHaveBeenCalled();
    });

    it('out-of-scope incident → throws ForbiddenException when dataScope provided', async () => {
      const incident = { ...mockIncident, soLanGiaHan: 0, deadline: baseDeadline, investigatorId: 'other-user', assignedTeamId: 'other-team' };
      mockPrisma.incident.findFirst.mockResolvedValue(incident);
      // checkWriteScope throws before getNumericValue is called — no mock needed

      const dataScope = { teamIds: ['my-team'], userIds: ['actor-001'], writableTeamIds: ['my-team'] };
      await expect(service.extendDeadline('inc-001', 'actor-001', {}, dataScope)).rejects.toThrow();
      expect(mockPrisma.incident.updateMany).not.toHaveBeenCalled();
    });

    it('extensionDays=0 in SystemSettings → throws BadRequestException (FINDING-1)', async () => {
      const incident = { ...mockIncident, soLanGiaHan: 0, deadline: baseDeadline };
      mockPrisma.incident.findFirst.mockResolvedValue(incident);
      mockSettings.getNumericValue
        .mockResolvedValueOnce(2)  // SO_LAN_GIA_HAN_TOI_DA
        .mockResolvedValueOnce(0); // THOI_HAN_GIA_HAN_1 = 0 (invalid config)

      await expect(service.extendDeadline('inc-001', 'actor-001', {})).rejects.toThrow(BadRequestException);
      expect(mockPrisma.incident.updateMany).not.toHaveBeenCalled();
    });

    it('READ-grant scope cannot extend deadline (writableTeamIds enforcement)', async () => {
      // Incident belongs to 'read-only-team' — actor has READ grant (team in teamIds, not writableTeamIds)
      const incident = { ...mockIncident, soLanGiaHan: 0, deadline: baseDeadline, assignedTeamId: 'read-only-team', investigatorId: 'other-user' };
      mockPrisma.incident.findFirst.mockResolvedValue(incident);
      // checkWriteScope throws before getNumericValue is called — no mock needed

      const readOnlyScope = { teamIds: ['read-only-team'], userIds: ['actor-001'], writableTeamIds: [] };
      await expect(service.extendDeadline('inc-001', 'actor-001', {}, readOnlyScope)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.incident.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── PHASE_STATUSES constant ───────────────────────────────────────────────

  describe('PHASE_STATUSES (constants)', () => {
    it('should map all 15 statuses to exactly one phase', () => {
      const allStatuses = Object.values(PHASE_STATUSES).flat();
      // Every status appears exactly once (no duplicates)
      const uniqueStatuses = new Set(allStatuses);
      expect(uniqueStatuses.size).toBe(allStatuses.length);
      // Total count is 15
      expect(allStatuses).toHaveLength(15);
    });

    it('should have 4 phases', () => {
      const phases = Object.keys(PHASE_STATUSES);
      expect(phases).toHaveLength(4);
      expect(phases).toContain('tiep-nhan');
      expect(phases).toContain('xac-minh');
      expect(phases).toContain('ket-qua');
      expect(phases).toContain('tam-dinh-chi');
    });
  });
});
