import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LegacyMigrationService } from './legacy-migration.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { LegacyRecord } from './legacy-mapper';

// ---- mock factories --------------------------------------------------------

const mockTx: any = {
  petition: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  incident: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  case: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  caseStatistic: { upsert: jest.fn(), deleteMany: jest.fn() },
  guidanceRecord: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  exchange: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  proposal: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  lawyer: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  crime: { findFirst: jest.fn() },
};

const mockPrisma = {
  crime: { findFirst: jest.fn() },
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn() };

// ---- helpers ---------------------------------------------------------------

const petitionRec: LegacyRecord = {
  id: 'L-001',
  phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau',
  ten_ca_nhan_co_quan_to_chuc_cung_cap: 'Nguyễn Văn A',
  ngay_tiep_nhan_nguon_tin: '15/04/2025',
};

const incidentRec: LegacyRecord = {
  id: 'L-002',
  phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau',
  tom_tat_noi_dung: 'Vụ trộm xe',
};

const caseRec: LegacyRecord = {
  id: 'L-003',
  phan_loai_nguon_tin_ban_dau: 'vu-an-ban-dau',
  tom_tat_noi_dung: 'Vụ án ma túy',
  toi_danh_chinh: '95',
};

// ---- tests -----------------------------------------------------------------

describe('LegacyMigrationService', () => {
  let service: LegacyMigrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegacyMigrationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<LegacyMigrationService>(LegacyMigrationService);
    jest.clearAllMocks();
    // Default: $transaction runs its callback with mockTx
    mockPrisma.$transaction.mockImplementation((fn: any) => fn(mockTx));
    mockTx.petition.findFirst.mockResolvedValue(null);
    mockTx.petition.create.mockResolvedValue({ id: 'p1' });
    mockTx.incident.findFirst.mockResolvedValue(null);
    mockTx.incident.create.mockResolvedValue({ id: 'i1' });
    mockTx.case.findFirst.mockResolvedValue(null);
    mockTx.case.create.mockResolvedValue({ id: 'c1' });
    mockTx.crime.findFirst.mockResolvedValue(null);
    mockTx.petition.deleteMany.mockResolvedValue({ count: 0 });
    mockTx.incident.deleteMany.mockResolvedValue({ count: 0 });
    mockTx.case.deleteMany.mockResolvedValue({ count: 0 });
    mockTx.caseStatistic.upsert.mockResolvedValue({ id: 's1' });
    mockTx.caseStatistic.deleteMany.mockResolvedValue({ count: 0 });
    mockTx.guidanceRecord.findFirst.mockResolvedValue(null);
    mockTx.guidanceRecord.create.mockResolvedValue({ id: 'g1' });
    mockTx.guidanceRecord.deleteMany.mockResolvedValue({ count: 0 });
    mockTx.exchange.findFirst.mockResolvedValue(null);
    mockTx.exchange.create.mockResolvedValue({ id: 'e1' });
    mockTx.exchange.deleteMany.mockResolvedValue({ count: 0 });
    mockTx.proposal.findFirst.mockResolvedValue(null);
    mockTx.proposal.create.mockResolvedValue({ id: 'pr1' });
    mockTx.proposal.deleteMany.mockResolvedValue({ count: 0 });
    mockTx.lawyer.findFirst.mockResolvedValue(null);
    mockTx.lawyer.create.mockResolvedValue({ id: 'lw1' });
    mockTx.lawyer.deleteMany.mockResolvedValue({ count: 0 });
    mockAudit.log.mockResolvedValue(undefined);
  });

  // ---- dryRun ---------------------------------------------------------------

  describe('dryRun', () => {
    it('trả MigrationReport mà không ghi DB', () => {
      const report = service.dryRun([petitionRec, incidentRec]);
      expect(report.totalRecords).toBe(2);
      expect(report.willCreatePetitions).toBe(1);
      expect(report.willCreateIncidents).toBe(1);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('báo cáo đúng khi batch rỗng', () => {
      const report = service.dryRun([]);
      expect(report.totalRecords).toBe(0);
    });
  });

  // ---- commit ---------------------------------------------------------------

  describe('commit', () => {
    it('tạo petition mới khi chưa có legacySourceId', async () => {
      const res = await service.commit([petitionRec], 'actor-1');
      expect(mockTx.petition.create).toHaveBeenCalledTimes(1);
      const createArgs = mockTx.petition.create.mock.calls[0][0].data;
      expect(createArgs.legacySourceId).toBe('L-001');
      expect(createArgs.senderName).toBe('Nguyễn Văn A');
      expect(res.created.petitions).toBe(1);
      expect(res.errors).toHaveLength(0);
    });

    // P1-3: trước đây `receivedDate ?? new Date()` gán NGÀY HÔM NAY cho hồ sơ 2017 khi
    // không parse được ngày (~4.400 hồ sơ) → sai hạn xử lý, sai KPI, sai lọc theo năm.
    it('thiếu ngày tiếp nhận → KHÔNG tạo, ghi lỗi, không bịa ngày hôm nay', async () => {
      const res = await service.commit(
        [{ id: 'L-404', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', ten_ca_nhan_co_quan_to_chuc_cung_cap: 'B' }],
        'actor-1',
      );
      expect(mockTx.petition.create).not.toHaveBeenCalled();
      expect(res.created.petitions).toBe(0);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0].legacyId).toBe('L-404');
      expect(res.errors[0].message).toContain('MISSING_REQUIRED_DATE');
    });

    // P1-1: khoá phải kèm tên collection, nếu không hồ sơ ho_so:1 ghi đè ho_so_doi_1:1.
    it('record có __sourceCollection → tra cứu VÀ ghi cùng một khoá có tiền tố', async () => {
      await service.commit(
        [{ ...petitionRec, id: 1, __sourceCollection: 'ho_so' }],
        'actor-1',
      );
      expect(mockTx.petition.findFirst).toHaveBeenCalledWith({ where: { legacySourceId: 'ho_so:1' } });
      expect(mockTx.petition.create.mock.calls[0][0].data.legacySourceId).toBe('ho_so:1');
    });

    it('update petition khi legacySourceId đã tồn tại (idempotent)', async () => {
      mockTx.petition.findFirst.mockResolvedValue({ id: 'existing-p1' });
      const res = await service.commit([petitionRec], 'actor-1');
      expect(mockTx.petition.update).toHaveBeenCalledTimes(1);
      expect(mockTx.petition.create).not.toHaveBeenCalled();
      expect(res.created.petitions).toBe(0);
    });

    it('tạo incident mới từ vụ việc record', async () => {
      const res = await service.commit([incidentRec], 'actor-1');
      expect(mockTx.incident.create).toHaveBeenCalledTimes(1);
      expect(res.created.incidents).toBe(1);
    });

    it('resolve crimeChinhLegacyValue → crimeChinhId qua tx (không dùng this.prisma)', async () => {
      const crimeObj = { id: 'crime-95' };
      mockTx.crime.findFirst.mockResolvedValue(crimeObj);
      await service.commit([caseRec], 'actor-1');
      // tx.crime.findFirst phải được gọi (không phải mockPrisma.crime.findFirst)
      expect(mockTx.crime.findFirst).toHaveBeenCalledWith({ where: { legacyValue: 95 } });
      expect(mockPrisma.crime.findFirst).not.toHaveBeenCalled();
      const createArgs = mockTx.case.create.mock.calls[0][0].data;
      expect(createArgs.crimeChinhId).toBe('crime-95');
      expect(createArgs.crimeChinhLegacyValue).toBeUndefined();
    });

    it('record không có id → skip (skipped++)', async () => {
      const res = await service.commit([{ phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' }], 'actor-1');
      expect(res.skipped).toBe(1);
      expect(res.created.petitions).toBe(0);
    });

    it('lỗi 1 record → ghi errors[], record khác vẫn xử lý', async () => {
      mockTx.petition.create
        .mockRejectedValueOnce(new Error('DB timeout'))
        .mockResolvedValueOnce({ id: 'p2' });
      const rec2: LegacyRecord = { id: 'L-002', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', ten_ca_nhan_co_quan_to_chuc_cung_cap: 'B', ngay_tiep_nhan_nguon_tin: '15/04/2025' };
      const res = await service.commit([petitionRec, rec2], 'actor-1');
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0].legacyId).toBe('L-001');
    });

    it('tạo caseStatistic.upsert khi record có field thống kê (Codex P1#7)', async () => {
      await service.commit(
        [{ ...caseRec, so_luong_bi_hai: '3', so_tien_bi_thiet_hai: '1.000.000' }],
        'actor-1',
      );
      expect(mockTx.caseStatistic.upsert).toHaveBeenCalledTimes(1);
      const args = mockTx.caseStatistic.upsert.mock.calls[0][0];
      expect(args.where).toEqual({ caseId: 'c1' });
      expect(args.create.soLuongBiHai).toBe(3);
      expect(args.create.soTienBiThietHai).toBe(1000000);
    });

    it('KHÔNG tạo caseStatistic khi record không có field thống kê', async () => {
      await service.commit([caseRec], 'actor-1');
      expect(mockTx.caseStatistic.upsert).not.toHaveBeenCalled();
    });

    it('set importedFrom/importedById/importedAt trên Case create (Codex P2#5 — Case/Incident có cột)', async () => {
      await service.commit([caseRec], 'actor-1');
      const data = mockTx.case.create.mock.calls[0][0].data;
      expect(data.importedFrom).toBe('legacy-db');
      expect(data.importedById).toBe('actor-1');
      expect(data.importedAt).toBeInstanceOf(Date);
    });

    it('ghi legacyRaw trên petition create (Codex P1#1 — không mất data)', async () => {
      await service.commit([petitionRec], 'actor-1');
      const data = mockTx.petition.create.mock.calls[0][0].data;
      expect(data.legacyRaw).toBeDefined();
      expect((data.legacyRaw as Record<string, unknown>).ten_ca_nhan_co_quan_to_chuc_cung_cap).toBe('Nguyễn Văn A');
    });

    it('ghi audit log sau commit', async () => {
      await service.commit([petitionRec], 'actor-1');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEGACY_MIGRATION_COMMIT', userId: 'actor-1' }),
      );
    });
  });

  // ---- PR-M3: linking provenance 1→nhiều (Codex P1#4) ----------------------

  describe('commit — linking provenance (Codex P1#4)', () => {
    it('Đơn + QĐ khởi tố → Case FROM_PETITION + linkedPetitionId (không TRANSFERRED rời rạc)', async () => {
      const rec: LegacyRecord = {
        id: 'L-010',
        phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau',
        ten_ca_nhan_co_quan_to_chuc_cung_cap: 'A',
        ngay_tiep_nhan_nguon_tin: '15/04/2025',
        quyet_dinh_khoi_to_vu_an: 'QĐ-1',
      };
      await service.commit([rec], 'actor-1');
      expect(mockTx.petition.create).toHaveBeenCalledTimes(1);
      const caseData = mockTx.case.create.mock.calls[0][0].data;
      expect(caseData.caseProvenance).toBe('FROM_PETITION');
      expect(caseData.linkedPetitionId).toBe('p1');
      expect(caseData.linkedIncidentId).toBeNull();
    });

    it('Vụ việc + QĐ khởi tố → Case FROM_INCIDENT + linkedIncidentId', async () => {
      const rec: LegacyRecord = {
        id: 'L-011',
        phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau',
        tom_tat_noi_dung: 'VV',
        quyet_dinh_khoi_to_vu_an: 'QĐ-2',
      };
      await service.commit([rec], 'actor-1');
      const caseData = mockTx.case.create.mock.calls[0][0].data;
      expect(caseData.caseProvenance).toBe('FROM_INCIDENT');
      expect(caseData.linkedIncidentId).toBe('i1');
      expect(caseData.linkedPetitionId).toBeNull();
    });

    it('Vụ án standalone (không petition/incident) → TRANSFERRED, không link', async () => {
      await service.commit([caseRec], 'actor-1');
      const caseData = mockTx.case.create.mock.calls[0][0].data;
      expect(caseData.caseProvenance).toBe('TRANSFERRED');
      expect(caseData.linkedPetitionId).toBeNull();
      expect(caseData.linkedIncidentId).toBeNull();
    });

    it('Ủy thác điều tra → Case provenance UY_THAC_DIEU_TRA + caseType, không link', async () => {
      const rec: LegacyRecord = {
        id: 'L-012',
        phan_loai_nguon_tin_ban_dau: 'uy-thac-dieu-tra',
        tom_tat_noi_dung: 'UTDT',
      };
      await service.commit([rec], 'actor-1');
      const caseData = mockTx.case.create.mock.calls[0][0].data;
      expect(caseData.caseProvenance).toBe('UY_THAC_DIEU_TRA');
      expect(caseData.caseType).toBe('UY_THAC_DIEU_TRA');
      expect(caseData.linkedPetitionId).toBeNull();
    });
  });

  // ---- PR-M3: tier ③ commit (idempotent theo legacySourceId) ---------------

  describe('commit — tier ③ (guidance/exchange/proposal/lawyer)', () => {
    const guidanceRec: LegacyRecord = {
      id: 'G-001',
      phan_loai_nguon_tin_ban_dau: 'huong-dan-ban-dau',
      ten_ca_nhan_co_quan_to_chuc_cung_cap: 'Người được HD',
      tom_tat_noi_dung: 'ND hướng dẫn',
    };

    it('huong-dan → tạo GuidanceRecord, đếm created.guidance', async () => {
      const res = await service.commit([guidanceRec], 'actor-1');
      expect(mockTx.guidanceRecord.create).toHaveBeenCalledTimes(1);
      const data = mockTx.guidanceRecord.create.mock.calls[0][0].data;
      expect(data.legacySourceId).toBe('G-001');
      expect(data.guidedPerson).toBe('Người được HD');
      expect(res.created.guidance).toBe(1);
    });

    it('huong-dan idempotent: legacySourceId đã có → update, không create', async () => {
      mockTx.guidanceRecord.findFirst.mockResolvedValue({ id: 'existing-g' });
      const res = await service.commit([guidanceRec], 'actor-1');
      expect(mockTx.guidanceRecord.update).toHaveBeenCalledTimes(1);
      expect(mockTx.guidanceRecord.create).not.toHaveBeenCalled();
      expect(res.created.guidance).toBe(0);
    });

    it('trao-doi → tạo Exchange, đếm created.exchanges', async () => {
      const res = await service.commit(
        [{ id: 'E-001', phan_loai_nguon_tin_ban_dau: 'trao-doi-chuyen-an', tom_tat_noi_dung: 'TĐ' }],
        'actor-1',
      );
      expect(mockTx.exchange.create).toHaveBeenCalledTimes(1);
      expect(res.created.exchanges).toBe(1);
    });

    it('kien-nghi-vks → Proposal với proposalNumber deterministic DX-LEGACY-<id>', async () => {
      const res = await service.commit(
        [{ id: 'P-001', phan_loai_nguon_tin_ban_dau: 'kien-nghi-vks', tom_tat_noi_dung: 'KN' }],
        'actor-1',
      );
      const data = mockTx.proposal.create.mock.calls[0][0].data;
      expect(data.proposalNumber).toBe('DX-LEGACY-P-001');
      expect(data.content).toBe('KN');
      expect(res.created.proposals).toBe(1);
    });

    it('lỗi bước sau trong cùng record → KHÔNG đếm created cho entity bị rollback (Codex P1)', async () => {
      // luat-su: tạo host Case xong, lawyer.create fail → cả transaction rollback.
      mockTx.lawyer.create.mockRejectedValueOnce(new Error('boom'));
      const res = await service.commit(
        [{ id: 'LS-9', phan_loai_nguon_tin_ban_dau: 'luat-su', ten_ca_nhan_co_quan_to_chuc_cung_cap: 'X' }],
        'actor-1',
      );
      expect(res.created.cases).toBe(0); // KHÔNG overcount dù case.create đã chạy trước khi rollback
      expect(res.created.lawyers).toBe(0);
      expect(res.errors).toHaveLength(1);
    });

    it('luat-su → tạo host Case + Lawyer(caseId=host, barNumber deterministic)', async () => {
      const res = await service.commit(
        [{ id: 'LS-001', phan_loai_nguon_tin_ban_dau: 'luat-su', ten_ca_nhan_co_quan_to_chuc_cung_cap: 'LS X' }],
        'actor-1',
      );
      expect(mockTx.case.create).toHaveBeenCalledTimes(1);
      const lawyerData = mockTx.lawyer.create.mock.calls[0][0].data;
      expect(lawyerData.caseId).toBe('c1');
      expect(lawyerData.fullName).toBe('LS X');
      expect(lawyerData.barNumber).toBe('LS-LEGACY-LS-001');
      expect(res.created.lawyers).toBe(1);
    });
  });

  // ---- rollback -------------------------------------------------------------

  describe('rollback', () => {
    it('xóa petition/incident/case theo legacyIds', async () => {
      mockTx.petition.deleteMany.mockResolvedValue({ count: 2 });
      mockTx.incident.deleteMany.mockResolvedValue({ count: 1 });
      mockTx.case.deleteMany.mockResolvedValue({ count: 0 });
      const res = await service.rollback(['L-001', 'L-002', 'L-003'], 'actor-1');
      expect(res.deleted).toBe(3);
    });

    it('xóa cả tier ③ (lawyer/guidance/exchange/proposal) theo legacySourceId — Codex P2#4', async () => {
      mockTx.lawyer.deleteMany.mockResolvedValue({ count: 1 });
      mockTx.guidanceRecord.deleteMany.mockResolvedValue({ count: 2 });
      mockTx.exchange.deleteMany.mockResolvedValue({ count: 1 });
      mockTx.proposal.deleteMany.mockResolvedValue({ count: 1 });
      const res = await service.rollback(['L-001'], 'actor-1');
      expect(mockTx.lawyer.deleteMany).toHaveBeenCalledWith({ where: { legacySourceId: { in: ['L-001'] } } });
      expect(mockTx.guidanceRecord.deleteMany).toHaveBeenCalled();
      expect(mockTx.exchange.deleteMany).toHaveBeenCalled();
      expect(mockTx.proposal.deleteMany).toHaveBeenCalled();
      // 1 lawyer + 2 guidance + 1 exchange + 1 proposal = 5
      expect(res.deleted).toBe(5);
    });

    it('xóa lawyer TRƯỚC case (FK Restrict lawyer.caseId → cases)', async () => {
      const order: string[] = [];
      mockTx.lawyer.deleteMany.mockImplementation(() => {
        order.push('lawyer');
        return Promise.resolve({ count: 0 });
      });
      mockTx.case.deleteMany.mockImplementation(() => {
        order.push('case');
        return Promise.resolve({ count: 0 });
      });
      await service.rollback(['L-001'], 'actor-1');
      expect(order.indexOf('lawyer')).toBeLessThan(order.indexOf('case'));
    });

    it('throw BadRequestException khi FK constraint (Prisma P2003)', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Foreign key constraint failed on field: P2003'));
      await expect(service.rollback(['L-001'], 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('re-throw lỗi không phải FK constraint', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Connection refused'));
      await expect(service.rollback(['L-001'], 'actor-1')).rejects.toThrow('Connection refused');
    });

    it('ghi audit log sau rollback', async () => {
      await service.rollback(['L-001'], 'actor-1');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEGACY_MIGRATION_ROLLBACK', userId: 'actor-1' }),
      );
    });
  });
});
