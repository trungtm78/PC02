import { validate } from 'class-validator';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import {
  CaseStatus,
  IncidentStatus,
  LoaiDon,
  PetitionStatus,
} from '@prisma/client';
import type { KhaiCotXuat } from './xuat-danh-sach';
import { hoTenCanBo, ngayVN } from './dinh-dang';
import { tachCotXuat } from './cot-xuat.dto';
import {
  KHAI_COT_XUAT_DON_THU,
  KHAI_COT_XUAT_DON_THU_PHUONG,
} from '../../petitions/xuat-danh-sach-don-thu';
import {
  KHAI_COT_XUAT_VU_AN,
  KHAI_COT_XUAT_VU_AN_PHUONG,
} from '../../cases/xuat-danh-sach-vu-an';
import {
  KHAI_COT_XUAT_VU_VIEC,
  KHAI_COT_XUAT_VU_VIEC_PHUONG,
} from '../../incidents/xuat-danh-sach-vu-viec';
import { XuatDanhSachDonThuDto } from '../../petitions/dto/xuat-danh-sach-don-thu.dto';
import { XuatDanhSachVuAnDto } from '../../cases/dto/xuat-danh-sach-vu-an.dto';
import { XuatDanhSachVuViecDto } from '../../incidents/dto/xuat-danh-sach-vu-viec.dto';

/**
 * Mỗi ô Excel phải in ĐÚNG thứ cán bộ thấy ở ô cùng cột trên màn (anh yêu cầu 18/09/2026: "xuất Excel
 * dữ liệu đã tìm kiếm"). Kiểm từng cột của cả sáu bảng khai với một dòng đủ dữ liệu và một dòng trống —
 * dòng trống không được in "null"/"undefined"/"Invalid Date".
 */
function doc<T>(khai: readonly KhaiCotXuat<T>[], dong: unknown) {
  return Object.fromEntries(khai.map((c) => [c.key, c.doc(dong as T)]));
}

// 01/09/2026 00:30 giờ Việt Nam = 31/08/2026 17:30 UTC: ô ngày phải theo giờ VN, không lùi một ngày.
const NGAY = new Date('2026-08-31T17:30:00Z');
const NGAY_VN = /^0?1\/0?9\/2026$/;
const CAN_BO = {
  firstName: 'Tuấn',
  lastName: 'Dương Trọng',
  username: 'tuandt',
};

describe('định dạng ô dùng chung', () => {
  it('ngày theo giờ Việt Nam; chuỗi ngày cũng đọc được; rỗng/hỏng → ô trống', () => {
    expect(ngayVN(NGAY)).toMatch(NGAY_VN);
    expect(ngayVN(NGAY.toISOString())).toMatch(NGAY_VN);
    expect(ngayVN(null)).toBe('');
    expect(ngayVN(undefined)).toBe('');
    expect(ngayVN('không phải ngày')).toBe('');
  });

  it('cán bộ: họ + tên; thiếu cả hai thì tên đăng nhập; không có cán bộ → trống', () => {
    expect(hoTenCanBo(CAN_BO)).toBe('Dương Trọng Tuấn');
    expect(hoTenCanBo({ firstName: 'Tuấn' })).toBe('Tuấn');
    expect(hoTenCanBo({ username: 'tuandt' })).toBe('tuandt');
    expect(hoTenCanBo({})).toBe('');
    expect(hoTenCanBo(null)).toBe('');
  });

  it('tách cột: bỏ khoảng trắng và phần rỗng; không còn gì → undefined (xuất mọi cột)', () => {
    expect(tachCotXuat(' stt , ,ngayDeXuat ')).toEqual(['stt', 'ngayDeXuat']);
    expect(tachCotXuat(' , ')).toBeUndefined();
    expect(tachCotXuat(undefined)).toBeUndefined();
  });
});

describe('Đơn thư — danh sách', () => {
  it('dòng đủ dữ liệu', () => {
    const v = doc(KHAI_COT_XUAT_DON_THU, {
      stt: '2026-11129',
      sttCu: '11129',
      ngayDeXuat: NGAY,
      nguonDon: 'Công an phường 1',
      senderName: 'Lê Nguyễn Yến Thanh',
      detailContent: 'Trình báo mất tài sản',
      donViGiaiQuyet: 'Đội 2',
      ketQuaXuLyKhac: 'Đã chuyển',
      enteredBy: CAN_BO,
      status: PetitionStatus.MOI_TIEP_NHAN,
      suspectedPerson: 'Nguyễn Văn B',
      deadline: NGAY,
      createdAt: NGAY,
    });
    expect(v.stt).toBe('26-11129 (11129)');
    expect(v.ngayDeXuat).toMatch(NGAY_VN);
    expect(v.nguonDon).toBe('Công an phường 1');
    expect(v.senderName).toBe('Lê Nguyễn Yến Thanh');
    expect(v.detailContent).toBe('Trình báo mất tài sản');
    expect(v.donViGiaiQuyet).toBe('Đội 2');
    expect(v.ketQuaXuLyKhac).toBe('Đã chuyển');
    expect(v.enteredBy).toBe('Dương Trọng Tuấn');
    expect(v.status).toBe('Mới tiếp nhận');
    expect(v.suspectedPerson).toBe('Nguyễn Văn B');
    expect(v.deadline).toMatch(NGAY_VN);
    expect(v.createdAt).toMatch(NGAY_VN);
  });

  it('dòng trống → mọi ô trống, trạng thái lạ in nguyên mã', () => {
    const v = doc(KHAI_COT_XUAT_DON_THU, { stt: '2026-5', status: 'LA' });
    expect(v.stt).toBe('26-5');
    expect(v.status).toBe('LA');
    for (const k of Object.keys(v).filter(
      (k) => !['stt', 'status'].includes(k),
    )) {
      expect([k, v[k]]).toEqual([k, '']);
    }
  });
});

describe('Đơn thư — tệp phường/xã', () => {
  it('dòng đủ dữ liệu', () => {
    const v = doc(KHAI_COT_XUAT_DON_THU_PHUONG, {
      stt: '2026-11129',
      senderName: 'Người A',
      petitionType: LoaiDon.TO_CAO,
      detailContent: 'Nội dung đầy đủ',
      summary: 'rút gọn',
      assignedTeam: { ward: { name: 'Phường Bến Thành' } },
      ngayDeXuat: NGAY,
      status: PetitionStatus.MOI_TIEP_NHAN,
    });
    expect(v).toEqual({
      stt: '26-11129',
      senderName: 'Người A',
      petitionType: 'Tố cáo',
      detailContent: 'Nội dung đầy đủ',
      phuongXa: 'Phường Bến Thành',
      ngayDeXuat: expect.stringMatching(NGAY_VN) as unknown,
      status: 'Mới tiếp nhận',
    });
  });

  it('chưa có nội dung đầy đủ → lùi bản rút gọn; loại lạ in nguyên mã; dòng trống không in "null"', () => {
    expect(
      doc(KHAI_COT_XUAT_DON_THU_PHUONG, {
        summary: 'rút gọn',
        petitionType: 'LA',
      }),
    ).toMatchObject({ detailContent: 'rút gọn', petitionType: 'LA' });
    const v = doc(KHAI_COT_XUAT_DON_THU_PHUONG, { status: 'LA' });
    expect(v).toEqual({
      stt: '',
      senderName: '',
      petitionType: '',
      detailContent: '',
      phuongXa: '',
      ngayDeXuat: '',
      status: 'LA',
    });
  });
});

describe('Vụ án — danh sách', () => {
  it('dòng đủ dữ liệu', () => {
    const v = doc(KHAI_COT_XUAT_VU_AN, {
      caseCode: '2026-9893',
      sttCu: ' 9893 ',
      ngayDeXuat: NGAY,
      subjects: [{ fullName: 'Kha Tử Thạnh' }, { fullName: null }],
      _count: { subjects: 3 },
      nguonDon: 'VKS',
      name: 'TÊN VỤ ÁN không phải cột này',
      tenCungCap: 'Người bị hại C',
      moTaChiTiet: 'Tóm tắt vụ án',
      donViGiaiQuyet: 'Đội 3',
      ketQuaXuLyKhac: 'Khởi tố',
      createdBy: { username: 'nhapmay' },
      status: CaseStatus.TIEP_NHAN,
      investigator: CAN_BO,
      crime: 'Trộm cắp tài sản',
      createdAt: NGAY,
    });
    expect(v.caseCode).toBe('26-9893 (9893)');
    expect(v.ngayDeXuat).toMatch(NGAY_VN);
    expect(v.doiTuongBiCan).toBe('Kha Tử Thạnh +2');
    expect(v.nguonDon).toBe('VKS');
    // Cột khoá `name` in TÊN NGƯỜI CUNG CẤP như màn, không in tên vụ án.
    expect(v.name).toBe('Người bị hại C');
    expect(v.moTaChiTiet).toBe('Tóm tắt vụ án');
    expect(v.donViGiaiQuyet).toBe('Đội 3');
    expect(v.ketQuaXuLyKhac).toBe('Khởi tố');
    expect(v.createdBy).toBe('nhapmay');
    expect(v.status).toBe('Tiếp nhận');
    expect(v.investigator).toBe('Dương Trọng Tuấn');
    expect(v.crime).toBe('Trộm cắp tài sản');
    expect(v.createdAt).toMatch(NGAY_VN);
  });

  it('dòng trống → mọi ô trống; STT cũ chỉ có khoảng trắng thì không in ngoặc', () => {
    const v = doc(KHAI_COT_XUAT_VU_AN, {
      caseCode: '2026-1',
      sttCu: '  ',
      status: 'LA',
    });
    expect(v.caseCode).toBe('26-1');
    expect(v.status).toBe('LA');
    for (const k of Object.keys(v).filter(
      (k) => !['caseCode', 'status'].includes(k),
    )) {
      expect([k, v[k]]).toEqual([k, '']);
    }
  });
});

describe('Vụ án — tệp phường/xã', () => {
  it('dòng đủ dữ liệu: tội danh chính trước ô chữ; bị can dư ghi "(+N)"', () => {
    const v = doc(KHAI_COT_XUAT_VU_AN_PHUONG, {
      caseCode: '2026-9893',
      name: 'Vụ trộm xe',
      crimeChinh: { name: 'Trộm cắp tài sản' },
      crime: 'ô chữ cũ',
      subjects: [{ fullName: 'A' }, { fullName: 'B' }],
      _count: { subjects: 5 },
      assignedTeam: { ward: { name: 'Phường 1' } },
      investigator: CAN_BO,
      ngayDeXuat: NGAY,
      status: CaseStatus.TIEP_NHAN,
    });
    expect(v).toEqual({
      caseCode: '26-9893',
      name: 'Vụ trộm xe',
      crime: 'Trộm cắp tài sản',
      biCan: 'A, B (+3)',
      phuongXa: 'Phường 1',
      investigator: 'Dương Trọng Tuấn',
      ngayDeXuat: expect.stringMatching(NGAY_VN) as unknown,
      status: 'Tiếp nhận',
    });
  });

  it('không tội danh chính → ô chữ; ĐTV chỉ có tên đăng nhập → trống (như tệp cũ); dòng trống', () => {
    expect(
      doc(KHAI_COT_XUAT_VU_AN_PHUONG, {
        crime: 'ô chữ cũ',
        investigator: { username: 'dtv1' },
        subjects: [{ fullName: 'A' }],
      }),
    ).toMatchObject({ crime: 'ô chữ cũ', investigator: '', biCan: 'A' });
    expect(doc(KHAI_COT_XUAT_VU_AN_PHUONG, { status: 'LA' })).toEqual({
      caseCode: '',
      name: '',
      crime: '',
      biCan: '',
      phuongXa: '',
      investigator: '',
      ngayDeXuat: '',
      status: 'LA',
    });
  });
});

describe('Vụ việc — danh sách', () => {
  it('dòng đủ dữ liệu', () => {
    const v = doc(KHAI_COT_XUAT_VU_VIEC, {
      code: '2026-11732',
      sttCu: '11732',
      ngayDeXuat: NGAY,
      chuyenTuDonVi: 'Công an quận',
      name: 'tên vụ việc',
      benVu: 'Kha Tử Thạnh',
      description: 'Trình báo',
      donViGiaiQuyet: 'Đội 4',
      ketQuaXuLy: 'Đang xác minh',
      canBoNhap: CAN_BO,
      status: IncidentStatus.TIEP_NHAN,
      investigator: { lastName: 'Trần', firstName: 'C' },
      deadline: NGAY,
      createdAt: NGAY,
    });
    expect(v.code).toBe('26-11732 (11732)');
    expect(v.ngayDeXuat).toMatch(NGAY_VN);
    expect(v.chuyenTuDonVi).toBe('Công an quận');
    // Cột khoá `name` in người cung cấp/bị hại (`benVu`) như màn.
    expect(v.name).toBe('Kha Tử Thạnh');
    expect(v.description).toBe('Trình báo');
    expect(v.donViGiaiQuyet).toBe('Đội 4');
    expect(v.ketQuaXuLy).toBe('Đang xác minh');
    expect(v.canBoNhap).toBe('Dương Trọng Tuấn');
    expect(v.status).toBe('Tiếp nhận');
    expect(v.investigator).toBe('Trần C');
    expect(v.deadline).toMatch(NGAY_VN);
    expect(v.createdAt).toMatch(NGAY_VN);
  });

  it('dòng trống → mọi ô trống', () => {
    const v = doc(KHAI_COT_XUAT_VU_VIEC, { code: '2026-7', status: 'LA' });
    expect(v.code).toBe('26-7');
    expect(v.status).toBe('LA');
    for (const k of Object.keys(v).filter(
      (k) => !['code', 'status'].includes(k),
    )) {
      expect([k, v[k]]).toEqual([k, '']);
    }
  });
});

describe('Vụ việc — tệp phường/xã', () => {
  it('dòng đủ dữ liệu và dòng trống', () => {
    expect(
      doc(KHAI_COT_XUAT_VU_VIEC_PHUONG, {
        code: '2026-11732',
        name: 'Tên vụ việc',
        crimeChinh: { name: 'Lừa đảo' },
        benVu: 'Kha Tử Thạnh',
        assignedTeam: { ward: { name: 'Phường 2' } },
        investigator: { lastName: 'Trần' },
        ngayDeXuat: NGAY,
        status: IncidentStatus.TIEP_NHAN,
      }),
    ).toEqual({
      code: '26-11732',
      name: 'Tên vụ việc',
      toiDanhChinh: 'Lừa đảo',
      benVu: 'Kha Tử Thạnh',
      phuongXa: 'Phường 2',
      investigator: 'Trần',
      ngayDeXuat: expect.stringMatching(NGAY_VN) as unknown,
      status: 'Tiếp nhận',
    });
    expect(doc(KHAI_COT_XUAT_VU_VIEC_PHUONG, { status: 'LA' })).toEqual({
      code: '',
      name: '',
      toiDanhChinh: '',
      benVu: '',
      phuongXa: '',
      investigator: '',
      ngayDeXuat: '',
      status: 'LA',
    });
  });
});

/**
 * Tham số xuất = ĐÚNG bộ lọc của bảng + `cot`. Thiếu trường lọc trong DTO thì ValidationPipe
 * (whitelist) lặng lẽ bỏ nó và tệp xuất không khớp màn.
 */
describe('DTO xuất nhận bộ lọc của bảng + cột', () => {
  // Trường "Cán bộ nhập" mỗi loại một tên — đúng tên màn đang gửi.
  it.each<[string, ClassConstructor<object>, string]>([
    ['Đơn thư', XuatDanhSachDonThuDto, 'enteredById'],
    ['Vụ án', XuatDanhSachVuAnDto, 'createdById'],
    ['Vụ việc', XuatDanhSachVuViecDto, 'canBoNhapId'],
  ])('%s', async (_ten, Lop, truongCanBo) => {
    const thamSo = { cot: 'a,b', [truongCanBo]: 'u1' };
    const hopLe = plainToInstance(Lop, thamSo);
    expect(await validate(hopLe, { whitelist: true })).toEqual([]);
    expect(hopLe).toMatchObject(thamSo);

    const loi = await validate(plainToInstance(Lop, { cot: 'x'.repeat(1001) }));
    expect(loi.map((e) => e.property)).toContain('cot');
  });
});
