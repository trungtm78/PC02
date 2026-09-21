import { PassThrough } from 'stream';
import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { KHAI_COT_XUAT_VU_VIEC } from './xuat-danh-sach-vu-viec';

/**
 * Nút "Xuất Excel" trong khung Bộ lọc của màn Vụ việc: tệp chứa ĐÚNG các dòng đang lọc, theo thứ tự và
 * các cột đang hiện trên màn.
 */
const dong = (
  id: string,
  code: string,
  benVu: string,
  sttCu: string | null,
) => ({
  id,
  code,
  sttCu,
  ngayDeXuat: new Date('2026-09-10T00:00:00Z'),
  chuyenTuDonVi: 'Công an phường',
  benVu,
  description: 'Nội dung',
  donViGiaiQuyet: null,
  ketQuaXuLy: null,
  canBoNhap: {
    id: 'u1',
    firstName: 'Tuấn',
    lastName: 'Dương Trọng',
    username: 'tuan',
  },
  investigator: null,
  status: 'DANG_XAC_MINH',
  deadline: null,
  createdAt: new Date('2026-09-10T00:00:00Z'),
});

const mockPrisma = {
  incident: {
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

describe('IncidentsService.xuatDanhSach', () => {
  let service: IncidentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
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
          provide: DeadlineRulesService,
          useValue: { getActiveByKey: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: DocumentNumbersService,
          useValue: { commitWithTx: jest.fn(), draft: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(IncidentsService);
  });

  it('khoá cột trùng khoá cột màn Vụ việc (trừ Thao tác), đúng thứ tự', () => {
    expect(KHAI_COT_XUAT_VU_VIEC.map((c) => c.key)).toEqual([
      'code',
      'ngayDeXuat',
      'chuyenTuDonVi',
      'name',
      'description',
      'donViGiaiQuyet',
      'ketQuaXuLy',
      'canBoNhap',
      'status',
      'investigator',
      'deadline',
      'createdAt',
      // Sáu cột ngày mở cho tìm kiếm 21/09/2026 — cột hiện được trên bảng phải xuất được.
      'ngayTiepNhanNguonTin',
      'ngayQDPhanCongNguonTin',
      'ngayGiaoDonViGiaiQuyet',
      'ngayVietDon',
      'ngayPhieuChuyen',
      'ngayCapCccd',
    ]);
  });

  it('xuất đúng cột đang hiện, đúng thứ tự dòng, cùng điều kiện lọc với danh sách, ghi nhật ký', async () => {
    mockPrisma.incident.count.mockResolvedValue(2);
    mockPrisma.incident.findMany
      .mockResolvedValueOnce([{ id: 'b' }, { id: 'a' }])
      .mockResolvedValueOnce([
        dong('a', '2026-9706', 'Lê Nguyễn Yến Thanh', null),
        dong('b', '2026-11171', 'Kha Tử Thạnh', '208'),
      ]);
    const { res, docSheet } = resGia();
    await service.xuatDanhSach(
      { canBoNhapId: 'u1', cot: 'code,name,canBoNhap,status' } as never,
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
      'Người nhập',
      'Trạng thái',
    ]);
    expect((sheet.getRow(8).values as unknown[]).slice(1)).toEqual([
      1,
      '26-11171 (208)',
      'Kha Tử Thạnh',
      'Dương Trọng Tuấn',
      'Đang xác minh',
    ]);
    expect((sheet.getRow(9).values as unknown[]).slice(1)).toEqual([
      2,
      '26-9706',
      'Lê Nguyễn Yến Thanh',
      'Dương Trọng Tuấn',
      'Đang xác minh',
    ]);
    // Cùng điều kiện với danh sách (Cán bộ nhập có mặt ở cả đếm lẫn lấy id).
    const whereDem = (
      mockPrisma.incident.count.mock.calls[0] as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(whereDem.canBoNhapId).toBe('u1');
    // Hồ sơ bị xoá mềm GIỮA lúc lấy id và lúc đọc dòng thì không được lọt vào tệp.
    const whereDong = (
      mockPrisma.incident.findMany.mock.calls[1] as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(whereDong.deletedAt).toBeNull();
    const whereId = (
      mockPrisma.incident.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(whereId).toEqual(whereDem);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INCIDENT_EXPORTED',
        subject: 'Incident',
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
        { cot: 'code,matKhau' } as never,
        null,
        res as never,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.incident.count).not.toHaveBeenCalled();
  });
});
