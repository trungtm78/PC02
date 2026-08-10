/**
 * Flags that cannot be switched off, ever.
 *
 * Turning any of these off locks everybody out of the means to turn it back
 * on: no `auth` means no login, no `admin` means no admin screens, no
 * `feature-flags` means no way to reach this setting at all. Recovery would be
 * a `psql` session on production.
 *
 * Compile-time on purpose (ADR-0001). A database column would put the
 * lockout guard in the same place as the thing it guards, so one bad UPDATE
 * removes both. A constant in the build cannot be edited by a query.
 *
 * Enforced in three places, deliberately redundant:
 *   1. `isEnabled()` returns true for these regardless of what the row says,
 *      so a hand-edited database still boots.
 *   2. `setEnabled()` refuses `enabled: false` with a 400.
 *   3. The admin UI renders the toggle disabled.
 */
export const CORE_FEATURE_KEYS: readonly string[] = [
  'auth',
  'admin',
  'settings',
  'feature-flags',
  'audit',
  'dashboard',
];

const CORE_SET = new Set(CORE_FEATURE_KEYS);

export function isCoreFeature(key: string): boolean {
  return CORE_SET.has(key);
}
