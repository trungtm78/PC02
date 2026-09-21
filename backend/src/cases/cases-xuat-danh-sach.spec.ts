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

const mockPrisma = {
  case: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};
const audit = { log: jest.fn() };

function resGia() {
  const luong = new PassThrough();
  const phan: Buffer[] = [];
  luong.on('data', (c: Buffer) => phan.push(c));
  const res = Object.assign(luong, { setHeader: jest.fn() });
  const docSheet = async () => {
    await new Promise((r) => setImmediate(r));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.concat(phan) as never);
    return wb.worksheets[0];
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
    expect(whereDong.deletedAt).toBeNull();
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
});
