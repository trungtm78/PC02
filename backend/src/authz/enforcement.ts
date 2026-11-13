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
  /** The same without those held only through a conditional grant of the role: unconditional authority. */
  unconditionalKeysOf(userId: string): readonly string[] | undefined;
  /** What a person holds when enforced, or nothing if the configuration does not know them (never throws for that). */
  keysOrNone(userId: string): readonly string[] | undefined;
  /** Everybody who holds a permission, when enforced: for filters over many people at once. */
  holdersOf(permission: string): readonly string[] | undefined;
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
export function holdsPermission<T extends boolean | Promise<boolean>>(
  userId: string,
  permission: string,
  fromRole: () => T,
  /** `unconditional`: for the checks whose role fallback requires `conditions === null`. */
  options: { unconditional?: boolean } = {},
): T | boolean {
  const held = options.unconditional ? current?.unconditionalKeysOf(userId) : current?.keysOf(userId);
  return held ? held.includes(permission) : fromRole();
}

/**
 * The Prisma condition "a user who holds this permission", for filters over many people at once (who may be named as
 * an editor, who may be notified). Enforced: the people who hold it under permissions by team. Otherwise: the people
 * whose ROLE has it, exactly as such filters were written before.
 */
export function userHoldingPermission(action: string, subject: string): Record<string, unknown> {
  const holders = current?.holdersOf(`${action}:${subject}`);
  if (holders) return { id: { in: [...holders] } };
  return { role: { permissions: { some: { permission: { action, subject } } } } };
}

