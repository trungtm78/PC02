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
      const rec2: LegacyRecord = { id: 'L-002', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', ten_ca_nhan_co_quan_to_chuc_cung_cap: 'B' };
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

  // ---- rollback -------------------------------------------------------------

  describe('rollback', () => {
    it('xóa petition/incident/case theo legacyIds', async () => {
      mockTx.petition.deleteMany.mockResolvedValue({ count: 2 });
      mockTx.incident.deleteMany.mockResolvedValue({ count: 1 });
      mockTx.case.deleteMany.mockResolvedValue({ count: 0 });
      const res = await service.rollback(['L-001', 'L-002', 'L-003'], 'actor-1');
      expect(res.deleted).toBe(3);
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
