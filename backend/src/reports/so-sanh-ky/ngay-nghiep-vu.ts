/**
 * Cột ngày nào có nghĩa "hồ sơ ĐẾN trong kỳ này".
 *
 * ── Vì sao không dùng `createdAt` ──
 *
 * Đo trên máy thật ngày 30/08/2026, toàn bộ 54.845 hồ sơ đang có:
 *
 *     petitions  46.741 bản ghi — createdAt: 2026 → 2026   receivedDate:  225 → 2029
 *     incidents   4.723 bản ghi — createdAt: 2026 → 2026   ngayDeXuat:   2006 → 2036
 *     cases       3.381 bản ghi — createdAt: 2026 → 2026   receiveDate:   226 → 2026
 *
 * `createdAt` là NGÀY NHẬP MÁY. Sau đợt di trú, mọi hồ sơ từ 2006 tới nay đều mang createdAt
 * năm 2026. Báo cáo tháng đếm theo cột ấy không đo "hồ sơ đến khi nào" mà đo "cán bộ gõ vào máy
 * khi nào" — nên biểu đồ 12 tháng dồn cục vào tháng di trú, và phép so với cùng kỳ năm trước
 * luôn trả lời "năm ngoái không có hồ sơ nào" trong khi kho đang giữ hồ sơ từ 2006.
 *
 * ── Chọn cột theo SỐ ĐO, không theo tên nghe hay ──
 *
 *     petition.receivedDate    46.741 / 46.741 = 100%    (cột bắt buộc)
 *     incident.ngayDeXuat       4.723 /  4.723 = 100%    Đ.146 BLTTHS — ngày tiếp nhận nguồn tin
 *     case.receiveDate          3.339 /  3.381 = 98,8%
 *
 * Hai ứng viên khác bị loại vì phủ quá thấp: `incident.ngayTiepNhanNguonTin` (64%) và
 * `case.ngay_tiep_nhan` (57%). Chọn cột phủ thấp là lặng lẽ đánh rơi một phần ba số hồ sơ.
 */
export const COT_NGAY_TIEP_NHAN = {
  petition: 'receivedDate',
  incident: 'ngayDeXuat',
  case: 'receiveDate',
} as const;

/**
 * Khoảng năm coi là ngày thật.
 *
 * Đo được 2 hồ sơ trên 54.845 có năm ngoài khoảng (225, 226) — dấu vết ngày gõ hỏng ở hệ cũ.
 * Chúng không rơi vào kỳ nào nên không làm sai con số của kỳ, nhưng phải được ĐẾM RIÊNG chứ
 * không được biến mất: một hồ sơ không lọt vào báo cáo nào là một hồ sơ vô hình.
 *
 * Cùng khoảng với cột sinh `sortReceivedDate` ở `schema.prisma` — một luật, một chỗ hiểu.
 */
export const NAM_HOP_LE = { tu: 1900, den: 2100 } as const;

export function ngayHopLe(d: Date | null | undefined): boolean {
  if (!d) return false;
  const n = d.getFullYear();
  return n >= NAM_HOP_LE.tu && n <= NAM_HOP_LE.den;
}
