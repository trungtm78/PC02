import { BadRequestException } from '@nestjs/common';
import { khoaChung, kiemTheChung } from './khoa-chung';
import { KHAI_TIM_KIEM_DON_THU } from './khai/don-thu.khai';
import { KHAI_TIM_KIEM_VU_VIEC } from './khai/vu-viec.khai';
import { KHAI_TIM_KIEM_VU_AN } from './khai/vu-an.khai';

/**
 * Khoá CHUNG của nhiều khai — cho màn gộp nhiều loại hồ sơ vào một danh sách (Hồ sơ trễ hạn: Vụ án +
 * Vụ việc + Đơn thư). Một thẻ phải lọc được TRÊN CẢ BA bảng cùng một nghĩa, nên khoá chỉ tính là chung
 * khi mọi khai đều có và cùng kiểu.
 *
 * Bỏ kiểu `chon`: giá trị mỗi khai một bộ (ba enum trạng thái khác nhau) — một mã đúng ở bảng này là
 * 400 ở bảng kia.
 *
 * Danh sách ghim ở đây và ở `frontend/src/shared/tim-kiem/__tests__/khoa-chung.test.ts` — khai đổi mà
 * một phía quên theo là đỏ.
 */
const HO_SO = [
  KHAI_TIM_KIEM_DON_THU,
  KHAI_TIM_KIEM_VU_VIEC,
  KHAI_TIM_KIEM_VU_AN,
] as const;

/**
 * Khoá có ở CẢ BA khai hồ sơ — màn Tổng hợp gửi cùng một khoá tới ba API.
 *
 * Ba khoá cuối thêm ngày 21/09/2026 cùng đợt mở thẻ ngày. Chúng thành khoá CHUNG vì cả ba thực
 * thể đều có cột ấy và đều có dữ liệu thật (Đơn thư: Ngày viết đơn 41.820, Ngày phiếu chuyển
 * 9.315, Ngày cấp CCCD 2.168; Vụ việc: 298 / 86 / 37; Vụ án: 338 / 1.717 / 219). Hệ quả có chủ
 * ý: màn Tổng hợp nay lọc được theo ba cột ngày ấy.
 *
 * Thứ tự theo THỨ TỰ KHAI của Đơn thư, nên danh sách này đọc như gợi ý cán bộ nhìn thấy.
 */
const KHOA_CHUNG_HO_SO = [
  'stt',
  'sttCu',
  'ngayDeXuat',
  'nguonDon',
  'nguoiGui',
  'tomTat',
  'donViGiaiQuyet',
  'ketQuaXuLyKhac',
  'nguoiNhap',
  'ngayTao',
  'ngayVietDon',
  'ngayPhieuChuyen',
  'ngayCapCCCD',
];

describe('khoaChung', () => {
  it('ba khai hồ sơ → đúng các khoá có ở cả ba, cùng kiểu, không phải chon (thứ tự khai đầu)', () => {
    expect(khoaChung(HO_SO)).toEqual(KHOA_CHUNG_HO_SO);
  });

  it('khác kiểu giữa hai khai → không tính là chung', () => {
    const a = {
      ...KHAI_TIM_KIEM_DON_THU,
      truong: [{ key: 'x', nhan: 'X', kieu: 'chu' as const, cot: 'a' }],
    };
    const b = {
      ...KHAI_TIM_KIEM_VU_VIEC,
      truong: [{ key: 'x', nhan: 'X', kieu: 'ngay' as const, cot: 'b' }],
    };
    expect(khoaChung([a, b])).toEqual([]);
  });
});

describe('kiemTheChung', () => {
  it('thẻ "*" và khoá chung → qua', () => {
    expect(() =>
      kiemTheChung(['*~an', 'nguoiGui~binh', 'stt~2026-1'], HO_SO),
    ).not.toThrow();
  });

  it('khoá chỉ có ở một vài khai (trangThai, dieuTraVien, hanXuLy) → 400', () => {
    for (const khoa of ['trangThai', 'dieuTraVien', 'hanXuLy']) {
      expect(() => kiemTheChung([`${khoa}~x`], HO_SO)).toThrow(
        BadRequestException,
      );
    }
  });

  it('không có thẻ → qua', () => {
    expect(() => kiemTheChung(undefined, HO_SO)).not.toThrow();
  });
});
