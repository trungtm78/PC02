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
  // Seeded by prisma/seed.ts and compared by name at runtime:
  //   OFFICER            — bulk-import.controller.ts, calendar-events.controller.ts
  //   DEADLINE_APPROVER  — deadline-rules.service.ts (approver lookup)
  // They belong here so SYSTEM_ROLE_NAMES protects them from rename/delete.
  OFFICER: 'OFFICER',
  DEADLINE_APPROVER: 'DEADLINE_APPROVER',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

/**
 * Lookup set of the built-in role names above.
 *
 * These roles are referenced by name from guards, services and seed scripts,
 * so they must never be deleted through the admin API — a missing row here
 * silently disables every authorization check that compares against it.
 */
export const SYSTEM_ROLE_NAMES: ReadonlySet<string> = new Set<string>(
  Object.values(ROLE_NAMES),
);
