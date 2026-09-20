import { hoTen } from "@/lib/hoTen";
import type { OfficerOption } from "@/hooks/useOfficerOptions";

/** Hình cán bộ mà chi tiết đơn trả về (`assignedTo`, `canBoDeXuat`). */
export interface CanBoTuHoSo {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}

export const NHAN_NGUNG_HOAT_DONG = "không còn hoạt động";

/**
 * Giữ người ĐÃ ĐƯỢC CHỌN trong ô chọn cán bộ, kể cả khi người ấy không còn hoạt động.
 *
 * Danh sách cán bộ chỉ nạp tài khoản đang hoạt động — đúng cho việc CHỌN MỚI. Nhưng mở một
 * đơn cũ mà người được giao đã nghỉ hoặc bị khoá thì `<select>` không có mục nào khớp
 * `value`, nên trình duyệt để `selectedIndex = -1` và ô hiện TRẮNG — không phải "Chưa phân
 * công". Cán bộ thấy ô trống sẽ chọn người khác, tức phân công lại mà không ai định thế.
 *
 * Nên vẫn hiện người cũ, ghi rõ trạng thái, thay vì để ô trống nói dối.
 */
export function giuCanBoDaChon(
  danhSach: OfficerOption[],
  daChonId: string,
  canBo?: CanBoTuHoSo | null,
): OfficerOption[] {
  if (!daChonId) return danhSach;
  if (danhSach.some((o) => o.value === daChonId)) return danhSach;

  // Không có hồ sơ thì vẫn phải giữ mục: mất mục là mất phân công, tệ hơn hẳn một nhãn mờ.
  const ten = canBo ? hoTen(canBo) || canBo.username || "" : "";
  const nhan = ten ? `${ten} (${NHAN_NGUNG_HOAT_DONG})` : `Cán bộ ${NHAN_NGUNG_HOAT_DONG}`;
  return [{ value: daChonId, label: nhan, teams: [] }, ...danhSach];
}

/**
 * Nhãn của MỘT cán bộ, ưu tiên nhãn trong danh sách chọn.
 *
 * Danh sách chọn thêm `(tên đăng nhập)` khi hai người trùng họ tên — prod có 13 cặp. Dựng
 * nhãn từ hồ sơ máy chủ ở nơi khác là bỏ mất phần phân biệt ấy, nên cùng một người hiện hai
 * kiểu trong cùng một khung: ô chọn ghi "Bùi Thanh Trà (mrtea)", dòng phân công ghi
 * "Bùi Thanh Trà". Đúng lúc cần biết vừa giao cho ai thì không phân biệt được nữa.
 *
 * Không bao giờ trả chuỗi rỗng — một dòng phân công không tên là một dòng vô nghĩa.
 */
export function nhanCanBo(
  danhSach: OfficerOption[],
  id: string,
  canBo?: CanBoTuHoSo | null,
): string {
  const trongDanhSach = danhSach.find((o) => o.value === id);
  if (trongDanhSach) return trongDanhSach.label;
  const ten = canBo ? hoTen(canBo) || canBo.username || "" : "";
  return ten || id;
}
