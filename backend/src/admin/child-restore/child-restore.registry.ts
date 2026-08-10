/**
 * E3 — 9 loại hồ sơ con có xoá mềm nhưng chưa có đường khôi phục.
 *
 * Xoá mềm mà không khôi phục được thì "mềm" chỉ là cách nói: bản ghi biến mất
 * khỏi mọi màn hình và cách duy nhất lấy lại là `UPDATE ... SET deleted_at =
 * NULL` bằng psql. Với hồ sơ tố tụng, xoá nhầm rồi phải nhờ quản trị viên vào
 * cơ sở dữ liệu là một quy trình không ai muốn viết ra giấy.
 *
 * Một bảng cấu hình thay cho 9 service gần giống nhau. Điều kiện "entity thứ
 * ba" mà kế hoạch nhắc đã qua từ lâu: `Case`, `Incident`, `Petition` và
 * `Evidence` mỗi cái đã có một bản chép riêng, và bốn bản đó đã trôi khác nhau
 * ở chi tiết (`Evidence` chặn khôi phục dưới vụ án đã xoá, ba cái kia không).
 */

/** Cột nối tới hồ sơ cha, dùng để áp phạm vi dữ liệu. */
export type ParentLink =
  | { kind: 'case'; column: 'caseId' | 'relatedCaseId' }
  | { kind: 'none' };

export interface ChildRestoreTarget {
  /** Khoá trên URL: `/admin/restore/:resource`. */
  resource: string;
  /** Tên delegate của Prisma client. */
  model: string;
  /** Nhãn tiếng Việt cho thông báo và màn hình. */
  label: string;
  /** Cột dùng để tìm kiếm tự do. */
  searchFields: string[];
  parent: ParentLink;
}

export const CHILD_RESTORE_TARGETS: readonly ChildRestoreTarget[] = [
  {
    resource: 'subjects',
    model: 'subject',
    label: 'Đối tượng liên quan',
    searchFields: ['fullName', 'idNumber'],
    parent: { kind: 'case', column: 'caseId' },
  },
  {
    resource: 'lawyers',
    model: 'lawyer',
    label: 'Luật sư',
    searchFields: ['fullName', 'barNumber'],
    parent: { kind: 'case', column: 'caseId' },
  },
  {
    resource: 'documents',
    model: 'document',
    label: 'Tài liệu',
    searchFields: ['title', 'originalName'],
    parent: { kind: 'case', column: 'caseId' },
  },
  {
    resource: 'conclusions',
    model: 'conclusion',
    label: 'Kết luận điều tra',
    searchFields: ['content'],
    parent: { kind: 'case', column: 'caseId' },
  },
  {
    resource: 'delegations',
    model: 'delegation',
    label: 'Ủy thác điều tra',
    searchFields: ['noiDung'],
    parent: { kind: 'case', column: 'caseId' },
  },
  {
    resource: 'proposals',
    model: 'proposal',
    label: 'Đề xuất VKS',
    searchFields: ['content'],
    // `relatedCaseId` nullable: đề xuất có thể chưa gắn vụ án nào.
    parent: { kind: 'case', column: 'relatedCaseId' },
  },
  {
    // Ba loại dưới không nối tới hồ sơ cha nào, nên không có phạm vi tổ để áp.
    // Chỉ ADMIN khôi phục được — đó là lý do endpoint đòi `restore:Case`, một
    // quyền mà seed chỉ cấp cho ADMIN.
    resource: 'guidance-records',
    model: 'guidanceRecord',
    label: 'Hướng dẫn đơn thư',
    searchFields: ['guidedPerson', 'subject'],
    parent: { kind: 'none' },
  },
  {
    resource: 'exchanges',
    model: 'exchange',
    label: 'Trao đổi',
    searchFields: ['title'],
    parent: { kind: 'none' },
  },
  {
    resource: 'calendar-events',
    model: 'calendarEvent',
    label: 'Lịch công tác',
    searchFields: ['title'],
    parent: { kind: 'none' },
  },
];

export function findTarget(resource: string): ChildRestoreTarget | undefined {
  return CHILD_RESTORE_TARGETS.find((t) => t.resource === resource);
}
