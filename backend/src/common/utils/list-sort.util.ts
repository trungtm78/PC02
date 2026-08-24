/**
 * Dựng mệnh đề sắp xếp cho MỌI danh sách (Đơn thư, Vụ việc, Vụ án, UTDT...).
 *
 * VÌ SAO GOM VỀ MỘT CHỖ: trước đây ba module chép nguyên đoạn logic giống hệt nhau, và
 * chuỗi `'createdAt'` xuất hiện BA LẦN mỗi module — mặc định trong DTO, mặc định lúc bóc
 * tham số, và nhánh dự phòng của danh sách trắng. 21 chỗ ghi cứng rải rác, đổi mặc định
 * là phải nhớ đủ 21 chỗ. Giờ mỗi module chỉ khai `{ defaultField, allowed }`.
 *
 * Ba điều lớp này bảo đảm, mà bản cũ không có:
 *
 *  1. **Chiều sắp được làm sạch.** Đơn thư và Vụ việc trước đây không có validator cho
 *     `sortOrder`; chuỗi bất kỳ đi thẳng vào Prisma. Ở đây chỉ `'asc'` mới là tăng dần,
 *     còn lại đều về `'desc'`.
 *  2. **Hồ sơ trống chìm xuống cuối.** Postgres mặc định NULLS FIRST ở chiều DESC, nên
 *     hồ sơ KHÔNG có ngày sẽ nổi lên đầu — đúng thứ cần tránh. Khai trường vào
 *     `nullableFields` để nó nhận `nulls: 'last'`.
 *  3. **Khoá phụ ổn định.** Không có nó, các hồ sơ trùng ngày đổi chỗ giữa hai truy vấn
 *     và cán bộ thấy hồ sơ lặp hoặc biến mất khi bấm sang trang.
 */

export type ListSortOrder = 'asc' | 'desc';

export interface BuildListOrderByOptions {
  /** Trường người dùng yêu cầu sắp. Không nằm trong `allowed` thì bị bỏ qua. */
  sortBy?: string;
  /** Chiều sắp người dùng yêu cầu. Bất kỳ giá trị nào khác `'asc'` đều thành `'desc'`. */
  sortOrder?: ListSortOrder;
  /** Danh sách trắng — chặn tên cột tuỳ tiện đi vào Prisma. */
  allowed: readonly string[];
  /** Trường dùng khi không yêu cầu, hoặc yêu cầu không hợp lệ. */
  defaultField: string;
  /** Trường có thể rỗng → hồ sơ trống bị đẩy xuống cuối. */
  nullableFields?: readonly string[];
  /**
   * Nắn tên trường người dùng gọi → cột thật dùng để sắp.
   * Dùng khi cột sắp khác cột hiển thị: Đơn thư cho bấm cột "Ngày nhận"
   * (`receivedDate`) nhưng phải sắp theo cột sinh `sortReceivedDate`.
   * Áp SAU khi kiểm danh sách trắng, nên cột thật không cần lộ ra giao diện.
   */
  fieldAliases?: Readonly<Record<string, string>>;
  /** Khoá phụ giữ thứ tự ổn định khi trùng giá trị. Mặc định `'id'`. */
  tieBreakField?: string;
}

export function buildListOrderBy({
  sortBy,
  sortOrder,
  allowed,
  defaultField,
  nullableFields = [],
  fieldAliases = {},
  tieBreakField = 'id',
}: BuildListOrderByOptions): Record<string, unknown>[] {
  const direction: ListSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  // Kiểm danh sách trắng theo tên NGƯỜI DÙNG gửi...
  const requested = sortBy && allowed.includes(sortBy) ? sortBy : defaultField;
  // ...rồi mới nắn sang cột thật. Thứ tự này giữ cột nội bộ (vd cột sinh) khỏi lộ
  // ra giao diện, và vẫn nắn được cả trường mặc định.
  const field = fieldAliases[requested] ?? requested;

  const primary: Record<string, unknown> = nullableFields.includes(field)
    ? { [field]: { sort: direction, nulls: 'last' } }
    : { [field]: direction };

  // Sắp theo chính khoá phụ thì không lặp lại nó lần nữa.
  if (field === tieBreakField) return [primary];

  return [primary, { [tieBreakField]: direction }];
}
