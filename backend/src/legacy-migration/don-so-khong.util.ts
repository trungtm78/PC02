/**
 * Quyết định một ô SỐ đang mang giá trị 0 có phải là ô trống bị chuyển nhầm hay không.
 *
 * Hệ cũ tự điền `"0"` vào ô số để trống. Bộ chuyển dữ liệu trước 26/08/2026 đọc nó thành con
 * số, nên trên máy thật có 30.089 đơn thư ghi `soTienBiThietHai = 0` và 30.956 đơn ghi
 * `soLuongBiHai = 0`, trong khi hệ cũ chỉ 1.447 và 599 hồ sơ mang số thật khác 0.
 *
 * Trong hồ sơ pháp lý, *"thiệt hại 0 đồng"* là một KHẲNG ĐỊNH còn *"chưa có số liệu"* là chưa
 * biết. Báo cáo thống kê cộng nhầm hai nhóm ấy vào nhau.
 *
 * KHÔNG dọn theo kiểu "hễ bằng 0 thì xoá": phải soi lại bản gốc trong `legacyRaw`. Cán bộ gõ
 * `"0 người"` là chủ ý ghi số không — giá trị ấy phải giữ.
 */
import { parseLegacySoLieu } from './legacy-mapper';

/**
 * `true` khi ô đang là 0 mà bản gốc hệ cũ vốn TRỐNG — tức con số ấy do bộ chuyển sinh ra.
 *
 * @param giaTriCot giá trị đang nằm trong cột
 * @param giaTriGoc giá trị nguyên bản trong `legacyRaw` của đúng khoá ấy
 */
export function laSoKhongDoChuyenNham(giaTriCot: unknown, giaTriGoc: unknown): boolean {
  if (giaTriCot === null || giaTriCot === undefined) return false;
  if (Number(giaTriCot) !== 0) return false;
  // Bản gốc đọc ra được một con số → cán bộ chủ ý ghi, giữ nguyên.
  return parseLegacySoLieu(giaTriGoc) === undefined;
}
