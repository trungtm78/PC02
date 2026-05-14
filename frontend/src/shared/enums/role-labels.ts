/**
 * Vietnamese labels for `roles.name` (DB wire format).
 *
 * Mirror keys with `backend/src/common/constants/role.constants.ts` ROLE_NAMES.
 * When backend adds a new role, append a key here. Missing keys fall back to
 * the raw value via `getRoleLabel` — UI keeps working but shows the constant
 * until labeled.
 */
export const ROLE_LABEL: Record<string, string> = {
  // Real seed roles in production DB (backend/prisma/seed.ts)
  ADMIN: 'Quản trị viên',
  OFFICER: 'Cán bộ điều tra',
  DEADLINE_APPROVER: 'Người phê duyệt thời hạn',
  // Legacy / role.constants.ts (kept for safety; not in current seed)
  SYSTEM: 'Hệ thống',
  INVESTIGATOR: 'Điều tra viên',
  TRUONG_DON_VI: 'Trưởng đơn vị',
};

export function getRoleLabel(name: string | null | undefined): string {
  if (!name) return '';
  return ROLE_LABEL[name] ?? name;
}
