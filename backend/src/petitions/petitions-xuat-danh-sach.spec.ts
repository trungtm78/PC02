import { CaseChildAccessService } from '../case-child-access/case-child-access.service';
import { ordinaryChildFixture } from '../case-child-access/test-child-access-fixture';
import { CaseEvidenceGovernanceService } from '../cases/evidence-governance/evidence-governance.service';
import { CaseSourceCreationService } from '../case-child-access/case-source-creation.service';
import { ordinarySourceFixture, setSourceFixtureScope } from '../case-child-access/test-source-creation-fixture';
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
      providers: [{ provide: CaseChildAccessService, useValue: ordinaryChildFixture(mockPrisma) },{ provide: CaseEvidenceGovernanceService, useValue: { assertDocumentCanChangeParent: jest.fn().mockResolvedValue(undefined) } },{ provide: CaseSourceCreationService, useValue: ordinarySourceFixture(mockPrisma) },
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
      // Anh yêu cầu 22/09/2026 — thứ tự phải KHỚP bảng trên màn: ngay trước "Nguồn đơn".
      'loaiThongTin',
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
      // Every other form field that holds data (03/11/2026): searchable, so it must be visible AND exportable.
      'soPhieuChuyen',
      'nhanThay',
      'deXuat',
      'huongXuLy',
      'raSoatTrung',
      'baoCaoBanGiamDocText',
      'ghiChuKhac',
      'phuongThucThuDoan',
      'phanLoaiNguonTin',
      'laCongNgheCao',
      'dieuTraVien',
      'senderPhone',
      'senderBirthYear',
      'senderIdNumber',
      'senderIdIssuePlace',
      'senderAddress',
      'soQDPhanCongNguonTin',
      'ngayQDPhanCongNguonTin',
      'soQDTamDinhChiNguonTin',
      'ngayQDTamDinhChiNguonTin',
      'canCuTamDinhChiNguonTin',
      'soPhucHoiNguonTin',
      'ngayPhucHoiNguonTin',
      'thoiHanUTDT',
      'crimeChinh',
      'soTienBiThietHai',
      'soLuongBiHai',
      'soQuyetDinhKhoiTo',
      'ngayKhoiTo',
      'toiDanhChinhKhoiTo',
    ]);
  });

  /**
   * Values the new columns render, from a fully populated row - a column that exports blank for data the list
   * shows is the silent failure the date columns suffered before.
   */
  it('new columns read the right fields of a populated row', () => {
    const row = {
      soPhieuChuyen: 'A16763',
      nhanThay: 'Bị can do Tổ công tác Số 8 thụ lý',
      deXuat: 'Đề xuất giao đơn',
      huongXuLy: 'CHUYEN_DON',
      raSoatTrung: 'Trùng đơn 2026-00001',
      baoCaoBanGiamDocText: 'Báo cáo BGĐ',
      ghiChuKhac: 'Ghi chú',
      phuongThucThuDoan: 'Giả danh',
      phanLoaiNguonTin: 'Tố giác',
      laCongNgheCao: true,
      dieuTraVien: 'Nguyễn Văn A',
      senderPhone: '0901234567',
      senderBirthYear: '1980',
      senderIdNumber: '079080001234',
      senderIdIssuePlace: 'Cục CSQLHC',
      senderAddress: '12 Lê Lợi, Q1',
      soQDPhanCongNguonTin: 'QD-PC-1',
      ngayQDPhanCongNguonTin: new Date('2026-08-02T00:00:00Z'),
      soQDTamDinhChiNguonTin: 'QD-TDC-1',
      ngayQDTamDinhChiNguonTin: new Date('2026-08-03T00:00:00Z'),
      canCuTamDinhChiNguonTin: 'Căn cứ',
      soPhucHoiNguonTin: 'PH-1',
      ngayPhucHoiNguonTin: new Date('2026-08-04T00:00:00Z'),
      thoiHanUTDT: new Date('2026-12-31T00:00:00Z'),
      crimeChinh: { name: 'Tội lừa đảo chiếm đoạt tài sản' },
      soTienBiThietHai: 1500.5,
      soLuongBiHai: 3,
      soQuyetDinhKhoiTo: 'KT-9',
      ngayKhoiTo: '2026-09-12',
      toiDanhChinhKhoiToTen: 'Tội giết người',
    };
    const doc = (key: string) =>
      KHAI_COT_XUAT_DON_THU.find((c) => c.key === key)!.doc(row as never);
    expect(doc('soPhieuChuyen')).toBe('A16763');
    expect(doc('nhanThay')).toBe('Bị can do Tổ công tác Số 8 thụ lý');
    expect(doc('huongXuLy')).toBe('Chuyển đơn');
    expect(doc('laCongNgheCao')).toBe('Có');
    expect(doc('ngayQDPhanCongNguonTin')).toBe('2/8/2026');
    expect(doc('thoiHanUTDT')).toBe('31/12/2026');
    expect(doc('crimeChinh')).toBe('Tội lừa đảo chiếm đoạt tài sản');
    expect(doc('soTienBiThietHai')).toBe('1.500,5');
    expect(doc('soLuongBiHai')).toBe('3');
    expect(doc('soQuyetDinhKhoiTo')).toBe('KT-9');
    expect(doc('ngayKhoiTo')).toBe('12/9/2026');
    expect(doc('toiDanhChinhKhoiTo')).toBe('Tội giết người');
  });

  it('new columns export blank (never "undefined"/"null") for a row without the data', () => {
    for (const key of [
      'soPhieuChuyen',
      'huongXuLy',
      'laCongNgheCao',
      'ngayQDPhanCongNguonTin',
      'crimeChinh',
      'soTienBiThietHai',
      'soLuongBiHai',
      'soQuyetDinhKhoiTo',
      'ngayKhoiTo',
      'toiDanhChinhKhoiTo',
    ]) {
      const out = KHAI_COT_XUAT_DON_THU.find((c) => c.key === key)!.doc({
        laCongNgheCao: null,
      } as never);
      expect(out).toBe('');
    }
  });
});
