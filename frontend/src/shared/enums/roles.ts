/**
 * Role names — must mirror `backend/src/common/constants/role.constants.ts`.
 *
 * Source of truth for role identifiers is the `roles.name` column. Backend
 * attaches `req.user.role` (string) on the JWT payload, frontend reads it
 * via the auth store. All role checks in pages should use `ROLE_NAMES.X`.
 */
export const ROLE_NAMES = {
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
  INVESTIGATOR: 'INVESTIGATOR',
  HEAD_UNIT: 'TRUONG_DON_VI',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];
