/**
 * Permission resource and action keys.
 *
 * Không còn mock. Quyền thật đến từ `GET /auth/me` (trường `permissions`) và
 * được `usePermission` đọc, fail-closed khi chưa nạp xong (ND-6). File này chỉ
 * còn giữ các khoá tên tài nguyên/hành động — giá trị chuỗi PHẢI khớp đúng tên
 * subject CASL của backend, xem `permission-mapping.ts`.
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
  // Its own key, not folded into REPORTS: the activity log is the only screen
  // the backend authorises with `read:AuditLog`, and every other report screen
  // is authorised with `read:Case`. One key for both made `can('reports')` true
  // for either grant.
  AUDIT_LOGS: 'audit-logs',
} as const;

export type PermissionResource =
  (typeof PERMISSION_RESOURCE)[keyof typeof PERMISSION_RESOURCE];

export const PERMISSION_ACTION = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
} as const;

export type PermissionAction =
  (typeof PERMISSION_ACTION)[keyof typeof PERMISSION_ACTION];

