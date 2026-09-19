/**
 * Khoá tài nguyên / hành động mà giao diện dùng để ẩn/hiện nút, và cách quy về quyền THẬT của máy chủ.
 *
 * Quyền thật đến từ GET /auth/me (`permissions: ['read:Case', …]`), đúng dạng `PermissionsGuard` so khớp. Trước
 * 19/09/2026 file này có MOCK_ALL_PERMISSIONS cho mọi người mọi quyền → cán bộ thấy nút rồi bấm mới nhận 403.
 */
export const PERMISSION_RESOURCE = {
  CASES: 'cases',
  PETITIONS: 'petitions',
  INCIDENTS: 'incidents',
  OBJECTS: 'objects',
  USERS: 'users',
  SETTINGS: 'settings',
  LAWYERS: 'lawyers',
  DIRECTORIES: 'directories',
  REPORTS: 'reports',
  CALENDAR: 'calendar',
} as const;

export type PermissionResource =
  (typeof PERMISSION_RESOURCE)[keyof typeof PERMISSION_RESOURCE];

export const PERMISSION_ACTION = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  /** Khôi phục bản ghi đã xoá — máy chủ đòi `restore:<Subject>` (các route bulk-restore / :id/restore). */
  RESTORE: 'restore',
} as const;

export type PermissionAction =
  (typeof PERMISSION_ACTION)[keyof typeof PERMISSION_ACTION];

/**
 * Tài nguyên giao diện → `subject` máy chủ, kèm hành động máy chủ đòi cho SỬA — đo từ `@RequirePermissions` của các
 * route PUT/PATCH (19/09/2026): hồ sơ nghiệp vụ đòi `edit`; danh mục, cài đặt, người dùng, báo cáo đòi `write`.
 * Xem = `read`, tạo = `write`, xoá = `delete` ở mọi tài nguyên.
 */
export const QUY_VE_QUYEN_MAY_CHU: Record<PermissionResource, { subject: string; sua: 'edit' | 'write' }> = {
  [PERMISSION_RESOURCE.CASES]: { subject: 'Case', sua: 'edit' },
  [PERMISSION_RESOURCE.PETITIONS]: { subject: 'Petition', sua: 'edit' },
  [PERMISSION_RESOURCE.INCIDENTS]: { subject: 'Incident', sua: 'edit' },
  [PERMISSION_RESOURCE.OBJECTS]: { subject: 'Subject', sua: 'edit' },
  [PERMISSION_RESOURCE.LAWYERS]: { subject: 'Lawyer', sua: 'edit' },
  [PERMISSION_RESOURCE.CALENDAR]: { subject: 'Calendar', sua: 'edit' },
  [PERMISSION_RESOURCE.USERS]: { subject: 'User', sua: 'write' },
  [PERMISSION_RESOURCE.SETTINGS]: { subject: 'Setting', sua: 'write' },
  [PERMISSION_RESOURCE.DIRECTORIES]: { subject: 'Directory', sua: 'write' },
  [PERMISSION_RESOURCE.REPORTS]: { subject: 'Report', sua: 'write' },
};

/** Khoá quyền máy chủ ('action:subject') cần cho một hành động trên tài nguyên giao diện; `null` nếu tài nguyên lạ. */
export function khoaQuyenMayChu(resource: string, action: PermissionAction): string | null {
  const quy = QUY_VE_QUYEN_MAY_CHU[resource as PermissionResource];
  if (!quy) return null;
  const hanhDong = { view: 'read', create: 'write', edit: quy.sua, delete: 'delete', restore: 'restore' }[action];
  return `${hanhDong}:${quy.subject}`;
}
