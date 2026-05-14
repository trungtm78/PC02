/**
 * Vietnamese labels for `roles.name` (DB wire format).
 *
 * Mirror keys with `backend/src/common/constants/role.constants.ts` ROLE_NAMES.
 * When backend adds a new role, append a key here. Missing keys fall back to
 * the raw value via `getRoleLabel` — UI keeps working but shows the constant
 * until labeled.
 */
export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  SYSTEM: 'Hệ thống',
  INVESTIGATOR: 'Điều tra viên',
  TRUONG_DON_VI: 'Trưởng đơn vị',
};

export function getRoleLabel(name: string | null | undefined): string {
  if (!name) return '';
  return ROLE_LABEL[name] ?? name;
}
