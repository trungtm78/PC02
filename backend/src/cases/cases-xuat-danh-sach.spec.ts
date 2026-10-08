import {ordinaryCaseAuthorityFixture,ordinaryCaseActorFixture,ordinaryCaseParentFixture} from './governance/case-ordinary-test.fixture';
import { PassThrough } from 'stream';
import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { KHAI_COT_XUAT_VU_AN } from './xuat-danh-sach-vu-an';

/**
 * Nút "Xuất Excel" trong khung Bộ lọc của Vụ án (anh yêu cầu 18/09/2026): tệp chứa ĐÚNG các dòng đang
 * lọc, theo thứ tự và các cột đang hiện trên màn.
 */
const dong = (id: string, caseCode: string, tenCungCap: string) => ({
  id,
  caseCode,
  sttCu: null,
  name: 'Tên vụ án — không phải cột "Tên cá nhân…"',
  tenCungCap,
  ngayDeXuat: new Date('2026-09-10T00:00:00Z'),
  nguonDon: 'Trực tiếp',
  moTaChiTiet: 'Nội dung',
  donViGiaiQuyet: null,
  ketQuaXuLyKhac: null,
  crime: 'Trộm cắp tài sản',
  subjects: [{ id: 's1', fullName: 'Nguyễn A' }],
  _count: { subjects: 3 },
  createdBy: {
    id: 'u1',
    firstName: 'Tuấn',
    lastName: 'Dương Trọng',
    username: 'tuan',
  },
  investigator: null,
  status: 'DANG_DIEU_TRA',
  createdAt: new Date('2026-09-10T00:00:00Z'),
});

const mockPrisma = {...ordinaryCaseAuthorityFixture(),
  case: {
    findFirst:ordinaryCaseParentFixture(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  subject: { count: jest.fn().mockResolvedValue(0) },
  evidence: { count: jest.fn().mockResolvedValue(0) },
  document: { count: jest.fn().mockResolvedValue(0) },
};
const audit = { log: jest.fn() };

function resGia() {
  const luong = new PassThrough();
  const phan: Buffer[] = [];
  luong.on('data', (c: Buffer) => phan.push(c));
  const res = Object.assign(luong, { setHeader: jest.fn() });
  const docSheet = async (index = 0) => {
    await new Promise((r) => setImmediate(r));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.concat(phan) as never);
    return wb.worksheets[index];
  };
  return { res, docSheet };
}

describe('CasesService.xuatDanhSach', () => {
  let service: CasesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: audit },
        {
          provide: SettingsService,
          useValue: {
            getValue: jest.fn().mockResolvedValue(null),
            getKyThongKe: jest.fn().mockResolvedValue({
              ky: 'TAT_CA',
              truong: 'NGAY_TIEP_NHAN',
              tuNgay: null,
              denNgay: null,
            }),
          },
        },
        {
          provide: DocumentNumbersService,
          useValue: { generate: jest.fn(), commitWithTx: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(CasesService);
  });

  it('khoá cột trùng khoá cột trên màn Danh sách vụ án (trừ Thao tác)', () => {
    expect(KHAI_COT_XUAT_VU_AN.map((c) => c.key)).toEqual([
      'caseCode',
      'ngayDeXuat',
      'doiTuongBiCan',
      'nguonDon',
      'name',
      'moTaChiTiet',
      'donViGiaiQuyet',
      'ketQuaXuLyKhac',
      'createdBy',
      'status',
      'investigator',
      'crime',
      'createdAt',
      // Năm cột ngày mở cho tìm kiếm 21/09/2026 — cột hiện được trên bảng phải xuất được.
      'receiveDate',
      'ngayPhieuChuyen',
      'ngayKhoiTo',
      'ngayVietDon',
      'ngayCapCccd',
    ]);
  });

  it('xuất đúng cột đang hiện, đúng thứ tự dòng, cùng điều kiện lọc với danh sách, ghi nhật ký', async () => {
    mockPrisma.case.count.mockResolvedValue(2);
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'b' }, { id: 'a' }])
      .mockResolvedValueOnce([
        dong('a', '2026-9893', 'Lê Nguyễn Yến Thanh'),
        { ...dong('b', '2026-11732', 'Kha Tử Thạnh'), sttCu: '208' },
      ]);
    const { res, docSheet } = resGia();
    await service.xuatDanhSach(
      {
        createdById: 'u1',
        cot: 'caseCode,name,doiTuongBiCan,createdBy,status',
      } as never,
      null,
      res as never,
      { userId: 'actor' },
    );
    const sheet = await docSheet();
    expect(sheet.getRow(7).values).toEqual([
      undefined,
      'STT',
      'STT',
      'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
      'Đối tượng bị can',
      'Người nhập',
      'Trạng thái',
    ]);
    expect((sheet.getRow(8).values as unknown[]).slice(1)).toEqual([
      1,
      '26-11732 (208)',
      'Kha Tử Thạnh',
      'Nguyễn A +2',
      'Dương Trọng Tuấn',
      'Đang điều tra',
    ]);
    expect((sheet.getRow(9).values as unknown[]).slice(1)).toEqual([
      2,
      '26-9893',
      'Lê Nguyễn Yến Thanh',
      'Nguyễn A +2',
      'Dương Trọng Tuấn',
      'Đang điều tra',
    ]);
    // Cùng điều kiện với danh sách (Cán bộ nhập có mặt ở cả đếm lẫn lấy id).
    const whereDem = (
      mockPrisma.case.count.mock.calls[0] as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(whereDem.createdById).toBe('u1');
    // Hồ sơ bị xoá mềm GIỮA lúc lấy id và lúc đọc dòng thì không được lọt vào tệp.
    const whereDong = (
      mockPrisma.case.findMany.mock.calls[1] as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(whereDong).toEqual({
      AND: [whereDem, { id: { in: ['b', 'a'] }, deletedAt: null }],
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CASE_EXPORTED',
        subject: 'Case',
        metadata: expect.objectContaining({
          kind: 'danh-sach',
          soDong: 2,
        }) as unknown,
      }),
    );
  });

  it('cột lạ → 400, không đọc CSDL', async () => {
    const { res } = resGia();
    await expect(
      service.xuatDanhSach(
        { cot: 'caseCode,matKhau' } as never,
        null,
        res as never,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.case.count).not.toHaveBeenCalled();
  });

  it('exports the displayed delegation columns without mixing regular cases', async () => {
    mockPrisma.case.count.mockResolvedValue(1);
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'delegation-1' }])
      .mockResolvedValueOnce([
        {
          ...dong('delegation-1', 'UTDT-001', 'Người cung cấp'),
          donViGiao: 'PC01',
          soQuyetDinhUyThac: '58/QD-2026',
          ketQuaUyThac: 'Đã xác minh địa chỉ đối tượng',
          ngayTraKetQua: new Date('2026-09-29T00:00:00.000Z'),
          thoiHanUyThac: null,
          metadata: {},
        },
      ]);
    const { res, docSheet } = resGia();
    await service.xuatDanhSach(
      {
        caseType: 'UY_THAC_DIEU_TRA',
        cot: 'caseCode,donViGiao,soQuyetDinhUyThac,ketQuaUyThac,status',
      } as never,
      null,
      res as never,
    );
    const sheet = await docSheet();
    expect(sheet.getRow(7).values).toEqual([
      undefined,
      'STT',
      'Mã hồ sơ',
      'Đơn vị giao',
      'Số QĐ/Phiếu',
      'Kết quả ủy thác',
      'Trạng thái',
    ]);
    expect((sheet.getRow(8).values as unknown[]).slice(1)).toEqual([
      1,
      'UTDT-001',
      'PC01',
      '58/QD-2026',
      'Đã xác minh địa chỉ đối tượng',
      'Đã phản hồi',
    ]);
    const where = (
      mockPrisma.case.findMany.mock.calls[1] as [
        { where: { AND: [{ caseType: string }, unknown] } },
      ]
    )[0].where;
    expect(where.AND[0].caseType).toBe('UY_THAC_DIEU_TRA');
  });

  it('exports full UTDT fields with a scoped and type-constrained hydration query', async () => {
    mockPrisma.case.count.mockResolvedValue(1);
    mockPrisma.case.findMany
      .mockResolvedValueOnce([{ id: 'delegation-1' }])
      .mockResolvedValueOnce([
        {
          id: 'delegation-1',
          caseType: 'UY_THAC_DIEU_TRA',
          name: 'Ủy thác mẫu',
          metadata: { ghiChu: 'Giữ nguyên' },
          legacyRaw: { maCu: 'OLD-1' },
          subjects: [{ caseId: 'delegation-1', fullName: 'Nguyễn A' }],
          evidences: [{ caseId: 'delegation-1', description: 'Vật chứng' }],
          statistic: { soTienBiThietHai: 100 },
          documents: [{ caseId: 'delegation-1', originalName: 'van-ban.pdf' }],
        },
      ]);
    const { res, docSheet } = resGia();
    await service.xuatDayDu(
      { caseType: 'UY_THAC_DIEU_TRA', createdById: 'owner-1' } as never,
      null,
      res as never,
      { userId: 'actor' },
    );
    const sheet = await docSheet();
    const headers = sheet.getRow(7).values as unknown[];
    const row = sheet.getRow(8).values as unknown[];
    expect(row[headers.indexOf('Mã định danh')]).toBe('delegation-1');
    expect(headers).not.toEqual(expect.arrayContaining(['metadata', 'legacyRaw', 'subjects']));
    expect((await docSheet(1)).name).toBe('Đối tượng');
    const subjectSheet = await docSheet(1);
    const subjectHeaders = subjectSheet.getRow(7).values as unknown[];
    const subjectRow = subjectSheet.getRow(8).values as unknown[];
    expect(subjectRow[subjectHeaders.indexOf('Họ tên đối tượng')]).toBeTruthy();
    expect(subjectRow[subjectHeaders.indexOf('Mã định danh hồ sơ')]).toBe('delegation-1');
    const evidenceSheet = await docSheet(2);
    expect(evidenceSheet.getRow(8).getCell(2).value).toBe('delegation-1');
    const documentSheet = await docSheet(3);
    expect(documentSheet.getRow(8).getCell(2).value).toBe('delegation-1');
    expect((await docSheet(2)).name).toBe('Vật chứng');
    expect((await docSheet(3)).name).toBe('Tài liệu');
    const countWhere = (
      mockPrisma.case.count.mock.calls[0] as unknown as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(countWhere).toMatchObject({
      caseType: 'UY_THAC_DIEU_TRA',
      createdById: 'owner-1',
    });
    const hydrate = (
      mockPrisma.case.findMany.mock.calls[1] as unknown as [
        { where: { AND: unknown[] }; select: Record<string, boolean> },
      ]
    )[0];
    expect(hydrate.where.AND).toEqual([
      countWhere,
      {
        id: { in: ['delegation-1'] },
        deletedAt: null,
        caseType: 'UY_THAC_DIEU_TRA',
      },
    ]);
    expect(hydrate.select).toMatchObject({ metadata: true, subjects: { where: { deletedAt: null } } });
    const auditCall = (
      audit.log.mock.calls[0] as unknown as [
        { action: string; metadata: { kind: string; soDong: number } },
      ]
    )[0];
    expect(auditCall.action).toBe('CASE_EXPORTED');
    expect(auditCall.metadata).toMatchObject({ kind: 'day-du', soDong: 1 });
  });

  it('keeps the documented 50,000-row cap for full UTDT exports', async () => {
    mockPrisma.case.count.mockResolvedValue(5_001);
    mockPrisma.case.findMany.mockResolvedValueOnce([]);
    const { res } = resGia();

    await service.xuatDayDu(
      { caseType: 'UY_THAC_DIEU_TRA' } as never,
      null,
      res as never,
    );

    expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50_000 }),
    );
  });
});
