/**
 * Role names — DB WIRE FORMAT.
 *
 * Values are stored verbatim in `roles.name` column (`roles` table) and
 * compared at runtime in guards/services. Renaming a value silently breaks
 * every authorization check that references it. Add new roles by appending,
 * never by renaming.
 *
 * `req.user.role` is attached as a plain string (not an object) by
 * JwtStrategy — so all comparisons read `user.role === ROLE_NAMES.X`.
 * (See: backend/src/auth/strategies/jwt.strategy.ts)
 */
export const ROLE_NAMES = {
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
  INVESTIGATOR: 'INVESTIGATOR',
  HEAD_UNIT: 'TRUONG_DON_VI',
  // Hai vai trò có thật trên prod (seed) mà trước 19/09/2026 thiếu ở đây — nên màn quản trị xoá/đổi tên
  // được chúng dù mã và seed so theo tên.
  OFFICER: 'OFFICER',
  DEADLINE_APPROVER: 'DEADLINE_APPROVER',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

/** Vai trò mà mã/seed so theo TÊN — không được xoá, đổi tên, hay để vai trò khác chiếm tên. */
export const VAI_TRO_HE_THONG: readonly string[] = Object.values(ROLE_NAMES);
