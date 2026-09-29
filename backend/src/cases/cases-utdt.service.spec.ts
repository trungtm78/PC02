/**
 * UTDT (Ủy Thác Điều Tra) — CasesService tests
 * Phase 3 TDD: RED first, then GREEN in cases.service.ts
 *
 * Tests:
 *   (a)   create UTDT case → caseType + caseProvenance stored
 *   (b)   getList caseType=UY_THAC_DIEU_TRA → only UTDT records
 *   (c)   getList (no param) → default REGULAR filter excludes UTDT
 *   (d-1) computeTrangThaiPhanHoi → DA_PHAN_HOI
 *   (d-2) computeTrangThaiPhanHoi → KHONG_THUC_HIEN_DUOC
 *   (d-3) computeTrangThaiPhanHoi → QUA_HAN
 *   (d-4) computeTrangThaiPhanHoi → CHUA_PHAN_HOI (default)
 *   (e-1..4) buildTrangThaiFilter × 4 states → correct Prisma WHERE
 *   (f)   getList UTDT search includes metadata.nghiVanDoiTuong
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CasesService,
  computeTrangThaiPhanHoi,
  hasUtdtReplyConflict,
  shouldRejectUtdtReplyConflict,
  buildTrangThaiFilter,
} from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import {
  CaseStatus,
  CaseProvenance,
  CaseType,
  LoaiUyThac,
} from '@prisma/client';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrismaCore = {
  case: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  petition: { create: jest.fn(), findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
  team: { findUnique: jest.fn() },
  caseStatusHistory: { create: jest.fn() },
  documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
  subject: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  evidence: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  document: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  $queryRaw: jest.fn().mockResolvedValue([]),
};
const mockPrisma = {
  ...mockPrismaCore,
  $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
    cb(mockPrismaCore),
  ),
};

const mockAudit = { log: jest.fn() };
const mockSettings = {
  getValue: jest.fn().mockResolvedValue(null),
  // Kỳ TAT_CA để ca kiểm sẵn có chốt đúng thứ chúng chốt, không có điều kiện ngày chen vào.
  getKyThongKe: jest.fn().mockResolvedValue({
    ky: 'TAT_CA',
    truong: 'NGAY_TIEP_NHAN',
    tuNgay: null,
    denNgay: null,
  }),
};
const mockDocNumbers = {
  generate: jest.fn().mockResolvedValue('PC02-UTDT-2026-00001'),
  commitWithTx: jest
    .fn()
    .mockResolvedValue({ number: 'PC02-UTDT-2026-00001', logId: 'log-001' }),
};

const baseCase = {
  id: 'case-utdt-001',
  name: 'Ủy thác test',
  crime: null,
  status: CaseStatus.TIEP_NHAN,
  investigatorId: 'user-001',
  deadline: null,
  unit: null,
  subjectsCount: 0,
  metadata: null,
  caseCode: null,
  capDoToiPham: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  caseProvenance: CaseProvenance.UY_THAC_DIEU_TRA,
  caseType: CaseType.UY_THAC_DIEU_TRA,
  donViGiao: 'PC01',
  soQuyetDinhUyThac: '123/QĐ-PC01',
  ngayTiepNhan: new Date('2026-05-01'),
  thoiHanUyThac: new Date('2026-06-01'),
  loaiUyThac: LoaiUyThac.UY_THAC_DIEU_TRA,
  ketQuaUyThac: null,
  ngayTraKetQua: null,
  loaiThongTin: 'Tố giác',
  investigator: {
    id: 'user-001',
    firstName: 'A',
    lastName: 'B',
    username: 'ab',
  },
  createdBy: { id: 'user-001', fullName: 'Nguyễn Văn A' },
};

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('UTDT — CasesService', () => {
  let service: CasesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.case.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: SettingsService, useValue: mockSettings },
        { provide: DocumentNumbersService, useValue: mockDocNumbers },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(CasesService);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // (a) create UTDT stores caseType + caseProvenance
  // ──────────────────────────────────────────────────────────────────────────
  describe('create UTDT', () => {
    it('rejects a newly contradictory reason and result before creating a record', async () => {
      await expect(
        service.create(
          {
            name: 'Conflicting delegation',
            caseProvenance: CaseProvenance.UY_THAC_DIEU_TRA,
            caseType: CaseType.UY_THAC_DIEU_TRA,
            metadata: { lyDoKhongThucHienDuoc: 'No authority' },
            ketQuaUyThac: 'Completed',
          },
          'user-001',
        ),
      ).rejects.toThrow();
      expect(mockPrisma.case.create).not.toHaveBeenCalled();
    });

    it('(a) stores caseType=UY_THAC_DIEU_TRA and caseProvenance=UY_THAC_DIEU_TRA', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-001',
        teams: [],
      });
      mockPrisma.case.create.mockResolvedValue(baseCase);
      mockPrisma.case.findUnique.mockResolvedValue(baseCase);

      await service.create(
        {
          name: 'Ủy thác test',
          caseProvenance: CaseProvenance.UY_THAC_DIEU_TRA,
          caseType: CaseType.UY_THAC_DIEU_TRA,
          donViGiao: 'PC01',
          soQuyetDinhUyThac: '123/QĐ-PC01',
          ngayTiepNhan: '2026-05-01',
          loaiUyThac: LoaiUyThac.UY_THAC_DIEU_TRA,
        },
        'user-001',
      );

      expect(mockPrisma.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseType: CaseType.UY_THAC_DIEU_TRA,
            caseProvenance: CaseProvenance.UY_THAC_DIEU_TRA,
            donViGiao: 'PC01',
          }),
        }),
      );
    });
  });

  it('rejects a changed contradiction in an existing delegation without writing', async () => {
    mockPrisma.case.findFirst.mockResolvedValue({
      ...baseCase,
      metadata: { lyDoKhongThucHienDuoc: 'No authority' },
      ketQuaUyThac: 'Reported',
    });
    await expect(
      service.update(
        'case-utdt-001',
        { ketQuaUyThac: 'Updated result' },
        'user-001',
      ),
    ).rejects.toThrow();
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // (b) getList with caseType=UY_THAC_DIEU_TRA filters to UTDT only
  // ──────────────────────────────────────────────────────────────────────────
  describe('getList UTDT filter', () => {
    it('(b) passes caseType=UY_THAC_DIEU_TRA in WHERE when query param set', async () => {
      mockPrisma.case.findMany.mockResolvedValue([baseCase]);
      mockPrisma.case.count.mockResolvedValue(1);

      await service.getList({ caseType: CaseType.UY_THAC_DIEU_TRA });

      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            caseType: CaseType.UY_THAC_DIEU_TRA,
          }),
        }),
      );
    });

    it('(c) default getList (no caseType) applies REGULAR filter — UTDT records excluded', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);
      mockPrisma.case.count.mockResolvedValue(0);

      await service.getList({});

      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            caseType: CaseType.REGULAR,
          }),
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // (d-1..4) computeTrangThaiPhanHoi — pure function, 4 states
  // ──────────────────────────────────────────────────────────────────────────
  describe('computeTrangThaiPhanHoi', () => {
    it('flags contradictory legacy data and rejects only new or changed contradictory values', () => {
      const legacy = {
        metadata: { lyDoKhongThucHienDuoc: 'No authority' },
        ketQuaUyThac: 'Reported',
      };
      expect(hasUtdtReplyConflict(legacy)).toBe(true);
      expect(shouldRejectUtdtReplyConflict(null, legacy)).toBe(true);
      expect(shouldRejectUtdtReplyConflict(legacy, { ...legacy })).toBe(false);
      expect(
        shouldRejectUtdtReplyConflict(legacy, {
          ...legacy,
          ketQuaUyThac: 'Updated',
        }),
      ).toBe(true);
      expect(
        shouldRejectUtdtReplyConflict(legacy, { ...legacy, ketQuaUyThac: '' }),
      ).toBe(false);
    });
    it('uses nonblank reason before a completed reply and ignores blank values', () => {
      const reply = {
        ketQuaUyThac: 'Completed',
        ngayTraKetQua: new Date('2026-09-28T08:00:00.000Z'),
        thoiHanUyThac: new Date('2026-09-28T00:00:00.000Z'),
      };
      expect(
        computeTrangThaiPhanHoi(
          { ...reply, metadata: { lyDoKhongThucHienDuoc: '  ' } },
          new Date('2026-09-29T08:00:00.000Z'),
        ),
      ).toBe('DA_PHAN_HOI');
      expect(
        computeTrangThaiPhanHoi(
          { ...reply, metadata: { lyDoKhongThucHienDuoc: 'Cannot proceed' } },
          new Date('2026-09-29T08:00:00.000Z'),
        ),
      ).toBe('KHONG_THUC_HIEN_DUOC');
    });

    it('waits until the end of the Bangkok deadline day', () => {
      const caseRecord = {
        ketQuaUyThac: '   ',
        ngayTraKetQua: null,
        thoiHanUyThac: new Date('2026-09-28T00:00:00.000Z'),
        metadata: null,
      };
      expect(
        computeTrangThaiPhanHoi(
          caseRecord,
          new Date('2026-09-28T16:59:59.999Z'),
        ),
      ).toBe('CHUA_PHAN_HOI');
      expect(
        computeTrangThaiPhanHoi(
          caseRecord,
          new Date('2026-09-28T17:00:00.000Z'),
        ),
      ).toBe('QUA_HAN');
    });
    it('(d-1) returns DA_PHAN_HOI when ketQuaUyThac and ngayTraKetQua both set', () => {
      const result = computeTrangThaiPhanHoi({
        ketQuaUyThac: 'Đã điều tra xong',
        ngayTraKetQua: new Date('2026-06-01'),
        thoiHanUyThac: new Date('2026-07-01'),
        metadata: null,
      });
      expect(result).toBe('DA_PHAN_HOI');
    });

    it('(d-2) returns KHONG_THUC_HIEN_DUOC when metadata.lyDoKhongThucHienDuoc is set', () => {
      const result = computeTrangThaiPhanHoi({
        ketQuaUyThac: null,
        ngayTraKetQua: null,
        thoiHanUyThac: new Date('2026-07-01'),
        metadata: { lyDoKhongThucHienDuoc: 'Vụ việc không thuộc thẩm quyền' },
      });
      expect(result).toBe('KHONG_THUC_HIEN_DUOC');
    });

    it('(d-3) returns QUA_HAN when thoiHanUyThac is past and no ketQua', () => {
      const result = computeTrangThaiPhanHoi({
        ketQuaUyThac: null,
        ngayTraKetQua: null,
        thoiHanUyThac: new Date('2020-01-01'), // far past
        metadata: null,
      });
      expect(result).toBe('QUA_HAN');
    });

    it('(d-4) returns CHUA_PHAN_HOI by default (no thoiHan, no ketQua, no lyDo)', () => {
      const result = computeTrangThaiPhanHoi({
        ketQuaUyThac: null,
        ngayTraKetQua: null,
        thoiHanUyThac: null,
        metadata: null,
      });
      expect(result).toBe('CHUA_PHAN_HOI');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // (e-1..4) buildTrangThaiFilter — pure function, returns Prisma WHERE shape
  // ──────────────────────────────────────────────────────────────────────────
  describe('buildTrangThaiFilter', () => {
    it('uses one Bangkok-day cutoff and retains incomplete replies for overdue review', () => {
      const now = new Date('2026-09-28T16:59:59.999Z');
      const overdue = buildTrangThaiFilter('QUA_HAN', now);
      expect(overdue.thoiHanUyThac).toEqual({
        lt: new Date('2026-09-27T17:00:00.000Z'),
      });
      expect(overdue.ketQuaUyThac).toBeUndefined();
    });
    it('(e-1) DA_PHAN_HOI requires a nonblank reply and date without a failure reason', () => {
      const filter = buildTrangThaiFilter('DA_PHAN_HOI');
      expect(filter).toMatchObject({
        utdtHasFailureReason: false,
        utdtHasReplyResult: true,
        ngayTraKetQua: { not: null },
      });
    });

    it('(e-2) KHONG_THUC_HIEN_DUOC uses the generated nonblank reason flag', () => {
      const filter = buildTrangThaiFilter('KHONG_THUC_HIEN_DUOC');
      expect(filter).toEqual({ utdtHasFailureReason: true });
    });

    it('(e-3) QUA_HAN uses the same Bangkok cutoff and excludes completed replies', () => {
      const filter = buildTrangThaiFilter('QUA_HAN');
      expect(filter).toMatchObject({
        thoiHanUyThac: expect.objectContaining({ lt: expect.any(Date) }),
        utdtHasFailureReason: false,
        NOT: { utdtHasReplyResult: true, ngayTraKetQua: { not: null } },
      });
    });

    it('(e-4) CHUA_PHAN_HOI excludes completed replies and overdue deadlines', () => {
      const filter = buildTrangThaiFilter('CHUA_PHAN_HOI');
      // Must be wrapped in NOT or be a compound that excludes the other 3
      expect(filter).toHaveProperty('NOT');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // (f) UTDT search includes metadata.nghiVanDoiTuong
  // ──────────────────────────────────────────────────────────────────────────
  describe('getList UTDT search', () => {
    /**
     * Ô tìm cũ trên Ủy thác vẫn tìm được Đối tượng nghi vấn: từ 15/09/2026 qua thẻ "tất cả các cột"
     * — cột ghép `tim_kiem_bd` gồm `nghiVanDoiTuong` (cột typed, đo prod phủ đúng như metadata).
     * Lùi về cột gốc khi chưa nạp cũng gồm cột ấy.
     */
    it('(f) search with caseType=UTDT tìm cả Đối tượng nghi vấn qua cột ghép', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);
      mockPrisma.case.count.mockResolvedValue(0);

      await service.getList({
        caseType: CaseType.UY_THAC_DIEU_TRA,
        search: 'Nguyễn',
      });

      const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
      const json = JSON.stringify(callArgs?.where?.AND);
      expect(callArgs?.where?.OR).toBeUndefined();
      expect(json).toContain('"timKiemBd":{"contains":"nguyen"}');
      expect(json).toContain('"nghiVanDoiTuong":{"contains":"Nguyễn"');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // (g) update UTDT persists top-level fields
  // ──────────────────────────────────────────────────────────────────────────
  describe('update UTDT fields', () => {
    const wrapUpdateAudit = {
      log: jest.fn().mockResolvedValue(undefined),
      wrapUpdate: jest.fn(
        async (opts: {
          fetchFn: () => Promise<unknown>;
          updateFn: () => Promise<unknown>;
        }) => {
          await opts.fetchFn();
          const after = await opts.updateFn();
          return after;
        },
      ),
    };

    it('(g) persists donViGiao and ngayTiepNhan when updating a UTDT case', async () => {
      const updated = {
        ...baseCase,
        donViGiao: 'PC02',
        ngayTiepNhan: new Date('2026-07-01'),
      };
      mockPrisma.case.findFirst.mockResolvedValue({ ...baseCase });
      mockPrisma.case.findUnique.mockResolvedValue(updated);
      mockPrisma.case.update.mockResolvedValue(updated);

      const module2 = await Test.createTestingModule({
        providers: [
          CasesService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: AuditService, useValue: wrapUpdateAudit },
          { provide: SettingsService, useValue: mockSettings },
          { provide: DocumentNumbersService, useValue: mockDocNumbers },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        ],
      }).compile();
      const svc2 = module2.get(CasesService);

      await svc2.update(
        'case-utdt-001',
        { donViGiao: 'PC02', ngayTiepNhan: '2026-07-01' },
        'user-001',
      );

      expect(mockPrisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            donViGiao: 'PC02',
            ngayTiepNhan: new Date('2026-07-01'),
          }),
        }),
      );
    });

    it('(h) persists ketQuaUyThac and ngayTraKetQua when updating UTDT result', async () => {
      const updated = {
        ...baseCase,
        ketQuaUyThac: 'Đã xác minh',
        ngayTraKetQua: new Date('2026-06-15'),
      };
      mockPrisma.case.findFirst.mockResolvedValue({ ...baseCase });
      mockPrisma.case.findUnique.mockResolvedValue(updated);
      mockPrisma.case.update.mockResolvedValue(updated);

      const module3 = await Test.createTestingModule({
        providers: [
          CasesService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: AuditService, useValue: wrapUpdateAudit },
          { provide: SettingsService, useValue: mockSettings },
          { provide: DocumentNumbersService, useValue: mockDocNumbers },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        ],
      }).compile();
      const svc3 = module3.get(CasesService);

      await svc3.update(
        'case-utdt-001',
        { ketQuaUyThac: 'Đã xác minh', ngayTraKetQua: '2026-06-15' },
        'user-001',
      );

      expect(mockPrisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ketQuaUyThac: 'Đã xác minh',
            ngayTraKetQua: new Date('2026-06-15'),
          }),
        }),
      );
    });
  });
});
