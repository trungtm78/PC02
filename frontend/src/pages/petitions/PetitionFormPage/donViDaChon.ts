import type { TeamOption } from "@/hooks/useTeamOptions";

/** Nhãn phụ cho giá trị không nằm trong danh sách Tổ/Nhóm. */
export const NHAN_NGOAI_DANH_SACH = "ngoài danh sách — giá trị đang lưu";

/**
 * Giữ giá trị "Đơn vị xử lý" ĐANG LƯU trong ô chọn, kể cả khi nó không phải một Tổ/Nhóm.
 *
 * Cột `donViGiaiQuyet` là CHỮ TỰ DO, còn ô chọn ở hướng Giao đơn / Trả đơn-Lưu đơn chỉ liệt kê
 * Tổ/Nhóm nội bộ. Hai vốn từ khác nhau, và dữ liệu thật nghiêng hẳn về phía chữ tự do.
 *
 * Đo prod 20/09/2026: **47.484 đơn có Đơn vị xử lý, 30.285 đơn (64%) mang tên không khớp tổ nội
 * bộ nào** — "Phòng PC46 CATP Hồ Chí Minh", "PC01 Công an TP Hồ Chí Minh"…
 *
 * `FKSelect` không thấy giá trị trong `options` thì hiện PLACEHOLDER. Nên 30.285 hồ sơ ấy mở ra
 * trông như ô RỖNG dù CSDL có giá trị — và cán bộ thấy ô trống sẽ chọn một tổ khác rồi bấm Cập
 * nhật. Đơn vị gốc bị ghi đè mà không ai chủ ý làm việc đó, cũng không có thông báo nào.
 *
 * Cùng lớp lỗi với cán bộ đã khoá rơi khỏi ô chọn (`giuCanBoDaChon`), và cùng cách vá: ghim giá
 * trị đang có lên đầu, nhãn nói rõ nó nằm ngoài danh sách chứ không giả vờ là một tổ.
 */
export function giuDonViDaChon(
  danhSach: TeamOption[],
  daChon: string,
): TeamOption[] {
  const sach = (daChon ?? "").trim();
  if (!sach) return danhSach;
  // So sau khi cắt khoảng trắng: dữ liệu hệ cũ nhiều dòng có khoảng trắng đuôi, ghim thêm một
  // mục trùng nghĩa là ô chọn hiện hai dòng nhìn giống hệt nhau.
  if (danhSach.some((o) => o.value.trim() === sach)) return danhSach;

  return [{ value: daChon, label: `${sach} (${NHAN_NGOAI_DANH_SACH})` }, ...danhSach];
}
