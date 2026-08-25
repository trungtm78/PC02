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

/**
 * Thứ tự hiển thị trên trang Cài đặt hệ thống.
 *
 * Máy chủ trả danh sách sắp theo TÊN KHOÁ, nên bốn khoá kỳ thống kê nằm rải rác và sai logic
 * đọc: "đến ngày" xuất hiện TRƯỚC "kỳ thống kê", còn "từ ngày" rơi xuống tận cuối. Người đọc
 * gặp mốc kết thúc trước cả khi biết đang cấu hình kỳ gì.
 *
 * Hai mốc ngày phải nằm KỀ NHAU và NGAY DƯỚI khoá kỳ, vì chúng chỉ có nghĩa khi kỳ là
 * "khoảng tuỳ chọn" — đặt xa nhau thì quan hệ ấy biến mất khỏi màn hình.
 *
 * Khoá không có trong bảng này giữ nguyên thứ tự máy chủ trả, xếp sau.
 */
export const THU_TU_HIEN_THI: readonly string[] = [
  'THONG_KE_KY',
  'THONG_KE_TU_NGAY',
  'THONG_KE_DEN_NGAY',
  'THONG_KE_TRUONG_NGAY',
] as const;

/** Khoá nào dùng ô CHỌN NGÀY thay vì ô gõ chữ. */
export const KHOA_KIEU_NGAY: readonly string[] = [
  'THONG_KE_TU_NGAY',
  'THONG_KE_DEN_NGAY',
] as const;

/**
 * Hai mốc ngày CHỈ có tác dụng khi kỳ là "khoảng tuỳ chọn".
 *
 * Trả về true khi ô đang không có tác dụng, để giao diện nói rõ điều đó. Để chúng trông như
 * bình thường thì admin nhập ngày, lưu thành công, và không có gì đổi — rồi kết luận hệ
 * thống hỏng.
 */
export function oNgayDangVoHieu(key: string, kyHienTai: string | undefined): boolean {
  return KHOA_KIEU_NGAY.includes(key) && kyHienTai !== 'KHOANG_TUY_CHON';
}

/** Sắp danh sách cài đặt theo thứ tự đọc hợp lý. */
export function sapXepCaiDat<T extends { key: string }>(ds: readonly T[]): T[] {
  const viTri = (k: string) => {
    const i = THU_TU_HIEN_THI.indexOf(k);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...ds].sort((a, b) => viTri(a.key) - viTri(b.key));
}
