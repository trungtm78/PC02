import { describe, it, expect } from 'vitest';
import { khoaChung } from '../khoa-chung';
import { TIM_KIEM_DON_THU, TIM_KIEM_VU_VIEC, TIM_KIEM_VU_AN } from '../generated';

/**
 * Khoá CHUNG của ba khai hồ sơ — gợi ý thẻ của màn Hồ sơ trễ hạn (một danh sách gộp Vụ án + Vụ việc +
 * Đơn thư). Máy chủ chỉ nhận "*" và đúng các khoá này (khoá khác 400).
 *
 * Danh sách ghim ở đây và ở `backend/src/common/tim-kiem/khoa-chung.spec.ts` — khai đổi mà một phía
 * quên theo là đỏ.
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
  // Ba khoá thêm 21/09/2026 cùng đợt mở thẻ ngày. Chúng thành khoá CHUNG vì cả ba thực thể đều
  // có cột ấy và đều có dữ liệu thật — hệ quả có chủ ý: màn Tổng hợp nay lọc được theo chúng.
  'ngayVietDon',
  'ngayPhieuChuyen',
  'ngayCapCCCD',
];

describe('khoaChung (giao diện)', () => {
  it('ba khai hồ sơ → đúng danh sách máy chủ nhận, thứ tự khai Đơn thư', () => {
    expect(
      khoaChung([TIM_KIEM_DON_THU, TIM_KIEM_VU_VIEC, TIM_KIEM_VU_AN]).map((t) => t.key),
    ).toEqual(KHOA_CHUNG_HO_SO);
  });

  it('trả trường đầy đủ (nhãn, kiểu) của khai đầu để ô thẻ gợi ý', () => {
    const [stt] = khoaChung([TIM_KIEM_DON_THU, TIM_KIEM_VU_VIEC, TIM_KIEM_VU_AN]);
    expect(stt).toEqual({ key: 'stt', nhan: 'STT', kieu: 'ma' });
  });
});
