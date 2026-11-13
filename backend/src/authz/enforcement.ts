import type { DataScope } from '../auth/services/unit-scope.service';

/**
 * What the request path asks about "permissions by team". Every answer is SYNCHRONOUS and comes from memory: the
 * permission configuration is loaded and refreshed in the background (see `AuthzService`), never by a request, so
 * asking costs nothing, cannot wait on the database, and takes no connection (it is also asked inside transactions).
 *
 * `undefined` = not enforced: the caller resolves the scope / reads the role exactly as before.
 */
export interface Enforcement {
  /** The record scope of a person when enforced: `null` = unrestricted (ADMIN). */
  scopeOf(userId: string): DataScope | null | undefined;
  /** The permissions a person holds, as `action:subject`, when enforced. */
  keysOf(userId: string): readonly string[] | undefined;
}

/**
 * The one enforcement of this process. A registry and not a constructor argument on purpose: several services are
 * built by hand (`new CaseGovernanceService(prisma)` in more than twenty places); an argument they forget to pass
 * would leave them silently on the role path while the rest of the system enforces. Whoever asks here gets the same
 * answer however it was constructed.
 */
let current: Enforcement | null = null;

export function setEnforcement(enforcement: Enforcement | null): void {
  current = enforcement;
}

export function enforcement(): Enforcement | null {
  return current;
}

/**
 * Whether a person holds a permission, for code that decides this itself instead of leaving it to the route guard.
 * When permissions by team are enforced the answer is what the person holds there; otherwise `fromRole` decides,
 * exactly as the caller decided before. Every such check goes through here, so the guard, `/auth/me` and the
 * services can never disagree about one person.
 */
export function holdsPermission<T extends boolean | Promise<boolean>>(userId: string, permission: string, fromRole: () => T): T | boolean {
  const held = current?.keysOf(userId);
  return held ? held.includes(permission) : fromRole();
}

