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
import { CasesService, computeTrangThaiPhanHoi, buildTrangThaiFilter } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { CaseStatus, CaseProvenance, CaseType, LoaiUyThac, Prisma } from '@prisma/client';
import { TrangThaiPhanHoi } from './dto/query-cases.dto';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
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
  $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
  $queryRaw: jest.fn().mockResolvedValue([]),
};

const mockAudit = { log: jest.fn() };
const mockSettings = { getValue: jest.fn().mockResolvedValue(null) };
const mockDocNumbers = {
  generate: jest.fn().mockResolvedValue('PC02-UTDT-2026-00001'),
  commitWithTx: jest.fn().mockResolvedValue({ number: 'PC02-UTDT-2026-00001', logId: 'log-001' }),
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
  investigator: { id: 'user-001', firstName: 'A', lastName: 'B', username: 'ab' },
  createdBy: { id: 'user-001', fullName: 'Nguyễn Văn A' },
};

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('UTDT — CasesService', () => {
  let service: CasesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: SettingsService, useValue: mockSettings },
        { provide: DocumentNumbersService, useValue: mockDocNumbers },
      ],
    }).compile();
    service = module.get(CasesService);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // (a) create UTDT stores caseType + caseProvenance
  // ──────────────────────────────────────────────────────────────────────────
  describe('create UTDT', () => {
    it('(a) stores caseType=UY_THAC_DIEU_TRA and caseProvenance=UY_THAC_DIEU_TRA', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-001', teams: [] });
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
    it('(e-1) DA_PHAN_HOI → WHERE ketQuaUyThac not null AND ngayTraKetQua not null', () => {
      const filter = buildTrangThaiFilter('DA_PHAN_HOI');
      expect(filter).toMatchObject({
        ketQuaUyThac: { not: null },
        ngayTraKetQua: { not: null },
      });
    });

    it('(e-2) KHONG_THUC_HIEN_DUOC → WHERE metadata.path lyDoKhongThucHienDuoc not JsonNull', () => {
      const filter = buildTrangThaiFilter('KHONG_THUC_HIEN_DUOC');
      expect(filter).toMatchObject({
        metadata: expect.objectContaining({ path: ['lyDoKhongThucHienDuoc'] }),
      });
    });

    it('(e-3) QUA_HAN → WHERE thoiHanUyThac lt now AND ketQuaUyThac null', () => {
      const filter = buildTrangThaiFilter('QUA_HAN');
      expect(filter).toMatchObject({
        thoiHanUyThac: expect.objectContaining({ lt: expect.any(Date) }),
        ketQuaUyThac: null,
      });
    });

    it('(e-4) CHUA_PHAN_HOI → complement: NOT (DA_PHAN_HOI OR KHONG OR QUA_HAN)', () => {
      const filter = buildTrangThaiFilter('CHUA_PHAN_HOI');
      // Must be wrapped in NOT or be a compound that excludes the other 3
      expect(filter).toHaveProperty('NOT');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // (f) UTDT search includes metadata.nghiVanDoiTuong
  // ──────────────────────────────────────────────────────────────────────────
  describe('getList UTDT search', () => {
    it('(f) search with caseType=UTDT includes metadata.nghiVanDoiTuong in OR clause', async () => {
      mockPrisma.case.findMany.mockResolvedValue([]);
      mockPrisma.case.count.mockResolvedValue(0);

      await service.getList({ caseType: CaseType.UY_THAC_DIEU_TRA, search: 'Nguyễn' });

      const callArgs = mockPrisma.case.findMany.mock.calls[0][0];
      const orClauses = callArgs?.where?.OR ?? [];
      const hasMetadataSearch = orClauses.some(
        (clause: unknown) =>
          typeof clause === 'object' &&
          clause !== null &&
          'metadata' in (clause as Record<string, unknown>),
      );
      expect(hasMetadataSearch).toBe(true);
    });
  });
});
