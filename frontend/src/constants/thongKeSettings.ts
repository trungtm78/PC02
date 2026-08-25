/**
 * Lựa chọn cho các khoá cấu hình kiểu "chọn một trong danh sách".
 *
 * Giá trị PHẢI khớp WIRE FORMAT của máy chủ (`common/utils/thong-ke-ky.util.ts`). Máy chủ
 * coi giá trị lạ là không hợp lệ và rơi về mặc định, nên gõ sai ở đây không làm vỡ gì — chỉ
 * làm cấu hình của admin lặng lẽ không có tác dụng, thứ khó phát hiện hơn nhiều.
 */
export interface LuaChonCaiDat {
  value: string;
  label: string;
}

export const KY_THONG_KE_OPTIONS: readonly LuaChonCaiDat[] = [
  { value: 'THANG_HIEN_TAI', label: 'Tháng hiện tại' },
  { value: 'QUY_HIEN_TAI', label: 'Quý hiện tại' },
  { value: 'NAM_HIEN_TAI', label: 'Năm hiện tại' },
  { value: 'KHOANG_TUY_CHON', label: 'Khoảng thời gian tuỳ chọn' },
  { value: 'TAT_CA', label: 'Tất cả (không giới hạn thời gian)' },
] as const;

export const TRUONG_NGAY_OPTIONS: readonly LuaChonCaiDat[] = [
  { value: 'NGAY_TIEP_NHAN', label: 'Ngày tiếp nhận' },
  { value: 'NGAY_TAO', label: 'Ngày tạo' },
] as const;

/** Khoá nào render ô CHỌN thay vì ô nhập chữ. */
export const LUA_CHON_THEO_KHOA: Record<string, readonly LuaChonCaiDat[]> = {
  THONG_KE_KY: KY_THONG_KE_OPTIONS,
  THONG_KE_TRUONG_NGAY: TRUONG_NGAY_OPTIONS,
};

/**
 * Giá trị mặc định, dùng cho nút "Về mặc định".
 *
 * Nằm ở mã chứ không ở cơ sở dữ liệu vì bảng `system_settings` không có cột mặc định. Phải
 * khớp phần seed ở máy chủ; lệch nhau thì "về mặc định" trả ra một giá trị khác với giá trị
 * hệ thống dùng khi cài mới.
 */
export const MAC_DINH_THEO_KHOA: Record<string, string> = {
  THONG_KE_KY: 'THANG_HIEN_TAI',
  THONG_KE_TRUONG_NGAY: 'NGAY_TIEP_NHAN',
  THONG_KE_TU_NGAY: '',
  THONG_KE_DEN_NGAY: '',
};

/** Nhãn kỳ để hiện trên thanh thẻ số, vd "Tháng 8/2026". */
export function nhanKyThongKe(ky: string, tuNgay: string | null, denNgay: string | null): string {
  if (ky === 'TAT_CA' || !tuNgay || !denNgay) return 'Tất cả thời gian';

  const tu = new Date(`${tuNgay}T00:00:00`);
  if (ky === 'NAM_HIEN_TAI') return `Năm ${tu.getFullYear()}`;
  if (ky === 'QUY_HIEN_TAI') return `Quý ${Math.floor(tu.getMonth() / 3) + 1}/${tu.getFullYear()}`;
  if (ky === 'THANG_HIEN_TAI') return `Tháng ${tu.getMonth() + 1}/${tu.getFullYear()}`;

  const den = new Date(`${denNgay}T00:00:00`);
  const dd = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${dd(tu)} – ${dd(den)}`;
}
