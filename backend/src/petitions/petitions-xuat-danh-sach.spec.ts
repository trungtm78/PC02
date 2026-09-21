import { PassThrough } from 'stream';
import { KHAI_COT_XUAT_DON_THU } from './xuat-danh-sach-don-thu';
import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PetitionsService } from './petitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

/**
 * Nút "Xuất Excel" trong khung Bộ lọc (anh yêu cầu 18/09/2026): tệp chứa ĐÚNG các dòng đang lọc, theo
 * thứ tự và các cột đang hiện trên màn.
 */
const dong = (id: string, stt: string, ten: string) => ({
  id,
  stt,
  sttCu: null,
  ngayDeXuat: new Date('2026-09-10T00:00:00Z'),
  nguonDon: 'Trực tiếp',
  senderName: ten,
  detailContent: 'Nội dung',
  donViGiaiQuyet: null,
  ketQuaXuLyKhac: null,
  enteredBy: {
    id: 'u1',
    firstName: 'Tuấn',
    lastName: 'Dương Trọng',
    username: 'tuan',
  },
  status: 'MOI_TIEP_NHAN',
  suspectedPerson: null,
  deadline: null,
  createdAt: new Date('2026-09-10T00:00:00Z'),
});

const mockPrisma = {
  petition: {
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

describe('PetitionsService.xuatDanhSach', () => {
  let service: PetitionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetitionsService,
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
          useValue: { generate: jest.fn(), commitWithTx: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(PetitionsService);
  });

  it('xuất đúng cột đang hiện, đúng thứ tự dòng, cùng điều kiện lọc với danh sách, ghi nhật ký', async () => {
    mockPrisma.petition.count.mockResolvedValue(2);
    mockPrisma.petition.findMany
      .mockResolvedValueOnce([{ id: 'b' }, { id: 'a' }])
      .mockResolvedValueOnce([
        dong('a', '2026-11129', 'Lê Nguyễn Yến Thanh'),
        dong('b', '2026-11732', 'Kha Tử Thạnh'),
      ]);
    const { res, docSheet } = resGia();
    await service.xuatDanhSach(
      { enteredById: 'u1', cot: 'stt,senderName,enteredBy' } as never,
      null,
      res as never,
      { userId: 'actor' },
    );
    const sheet = await docSheet();
    expect(sheet.getRow(7).values).toEqual([
      undefined,
      'STT',
      'STT hồ sơ',
      'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
      'Người nhập',
    ]);
    expect((sheet.getRow(8).values as unknown[]).slice(1)).toEqual([
      1,
      '26-11732',
      'Kha Tử Thạnh',
      'Dương Trọng Tuấn',
    ]);
    expect((sheet.getRow(9).values as unknown[]).slice(1)).toEqual([
      2,
      '26-11129',
      'Lê Nguyễn Yến Thanh',
      'Dương Trọng Tuấn',
    ]);
    // Cùng điều kiện với danh sách (Cán bộ nhập có mặt ở cả đếm lẫn lấy id).
    const whereDem = (
      mockPrisma.petition.count.mock.calls[0] as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(whereDem.enteredById).toBe('u1');
    // Hồ sơ bị xoá mềm GIỮA lúc lấy id và lúc đọc dòng thì không được lọt vào tệp.
    const whereDong = (
      mockPrisma.petition.findMany.mock.calls[1] as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(whereDong.deletedAt).toBeNull();
    const nhatKy = (
      audit.log.mock.calls[0] as [
        { action: string; metadata: Record<string, unknown> },
      ]
    )[0];
    expect(nhatKy.action).toBe('PETITION_EXPORTED');
    expect(nhatKy.metadata).toMatchObject({ kind: 'danh-sach', soDong: 2 });
  });

  it('cột lạ → 400, không đọc CSDL', async () => {
    const { res } = resGia();
    await expect(
      service.xuatDanhSach({ cot: 'stt,matKhau' } as never, null, res as never),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.petition.count).not.toHaveBeenCalled();
  });
});

/**
 * Lượt soát 21/09/2026 — P1: xuất Excel trả cột "Ngày viết đơn" RỖNG đúng với nhóm hồ sơ mà đợt
 * này vừa mở cho tìm được.
 *
 * ~4.400 đơn chỉ có ngày THIẾU thành phần: `petitionDate` NULL, chữ nằm ở `ngayVietDonEdtf`
 * (`2026-12-XX`). Màn hình đã hiện `__/12/2026` đúng, nhưng bộ xuất đọc thẳng `petitionDate` nên
 * cán bộ lọc theo Ngày viết đơn rồi bấm Xuất là nhận một tệp trống trơn ĐÚNG cột vừa lọc.
 *
 * Tệp xuất trông bình thường — không lỗi, không cảnh báo. Đúng lớp hỏng im lặng.
 */
describe('Xuất Đơn thư — ngày viết đơn THIẾU thành phần', () => {
  const cot = (k: string) => KHAI_COT_XUAT_DON_THU.find((c) => c.key === k)!;

  it('hồ sơ chỉ có EDTF → xuất ra chữ `__/12/2026`, KHÔNG để trống', () => {
    const ra = cot('petitionDate').doc({
      petitionDate: null,
      ngayVietDonEdtf: '2026-12-XX',
    } as never);
    expect(ra).toBe('__/12/2026');
  });

  it('hồ sơ có ngày ĐỦ → vẫn xuất ngày thật như cũ', () => {
    const ra = cot('petitionDate').doc({
      petitionDate: new Date('2026-12-15T00:00:00+07:00'),
      ngayVietDonEdtf: '2026-12-15',
    } as never);
    expect(ra).toContain('15/12/2026');
  });

  /**
   * Đơn thư THIẾU ca kiểm danh mục khoá xuất, trong khi Vụ án và Vụ việc đều có — nên sáu cột
   * xuất mới của đợt này từng là 0 ca kiểm, gồm đúng cột dính lỗi trên.
   */
  it('danh mục khoá xuất đúng và đủ', () => {
    expect(KHAI_COT_XUAT_DON_THU.map((c) => c.key)).toEqual([
      'stt',
      'ngayDeXuat',
      'nguonDon',
      'senderName',
      'detailContent',
      'donViGiaiQuyet',
      'ketQuaXuLyKhac',
      'enteredBy',
      'status',
      'suspectedPerson',
      'deadline',
      'createdAt',
      // Sáu cột ngày mở cho tìm kiếm 21/09/2026.
      'receivedDate',
      'ngayTiepNhanNguonTin',
      'petitionDate',
      'ngayGiaoDonViGiaiQuyet',
      'ngayPhieuChuyen',
      'senderIdIssueDate',
    ]);
  });
});
