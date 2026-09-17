/**
 * Điều kiện "tổ thụ lý" cho ba màn phường/xã (Đơn thư, Vụ việc, Vụ án) — MỘT chỗ cho danh sách, thống kê
 * và tệp xuất của cả ba bảng.
 *
 * - Chọn phường cụ thể (`wardTeamId`): hồ sơ của tổ gắn phường ấy.
 * - Chưa chọn phường nhưng màn là màn phường (`chiToPhuong`): hồ sơ của MỌI tổ có gắn phường. Thiếu điều
 *   kiện này (trước 17/09/2026) thì ADMIN/PC02 thấy cả hồ sơ của các Đội dưới tiêu đề "tổ phường/xã".
 * - Không yêu cầu gì: không lọc — màn danh sách chính dùng chung endpoint giữ nguyên hành vi.
 */
export function dieuKienToPhuong(
  wardTeamId: string | undefined | null,
  chiToPhuong: boolean | undefined | null,
): { is: { wardId: string | { not: null } } } | undefined {
  if (wardTeamId) return { is: { wardId: wardTeamId } };
  if (chiToPhuong) return { is: { wardId: { not: null } } };
  return undefined;
}
