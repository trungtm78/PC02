/**
 * Nhóm trạng thái — hạ tầng dùng chung cho drill-down thẻ thống kê.
 *
 * Một thẻ thống kê thường gộp NHIỀU trạng thái ("Đang xử lý" = DANG_XU_LY + CHO_PHE_DUYET).
 * Để bấm thẻ lọc được, client chỉ gửi KEY của nhóm; server giải nghĩa ra danh sách trạng thái.
 *
 * Vì sao không cho client gửi thẳng danh sách trạng thái (CSV): làm vậy thì frontend BUỘC
 * phải nắm thành viên của từng nhóm — đóng đinh vĩnh viễn đúng cái trùng lặp đang muốn tránh.
 * Với cách này, thành viên nhóm chỉ tồn tại DUY NHẤT ở backend.
 */

export type StatusGroups<T extends string = string> = Record<string, readonly T[]>;

/**
 * Giải nghĩa key nhóm → danh sách trạng thái. Trả `null` nếu key không hợp lệ (không lọc).
 *
 * BẮT BUỘC dùng `hasOwnProperty`: viết `groups[key]` trần sẽ leo prototype chain, nên
 * `?statusGroup=constructor` trả về hàm `Object` — truthy nhưng không phải mảng — rồi lọt
 * xuống Prisma dưới dạng `{ in: [Function] }` và ném lỗi 500. Đây là lỗi CÓ THẬT đang tồn
 * tại ở `incidents.service.ts` với param `phase`.
 */
export function resolveGroup<T extends string>(
  groups: StatusGroups<T>,
  key?: string | null,
): readonly T[] | null {
  if (!key) return null;
  if (!Object.prototype.hasOwnProperty.call(groups, key)) return null;
  return groups[key];
}

/**
 * Đếm số bản ghi theo từng nhóm, dựa trên `byStatus` mà `/stats` đã tính.
 *
 * Trả về ĐỦ mọi key nhóm (nhóm không có bản ghi nào → `0`, không phải `undefined`) để
 * frontend hiển thị `0` thay vì khung xương chờ mãi.
 */
export function countByGroup<T extends string>(
  groups: StatusGroups<T>,
  byStatus: Partial<Record<T, number>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(groups)) {
    out[key] = groups[key].reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);
  }
  return out;
}
