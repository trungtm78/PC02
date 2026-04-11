import type { DataScope } from '../../auth/services/unit-scope.service';

/**
 * Build Prisma where-clause filter for Case/Incident scope.
 * Uses investigatorId for ownership.
 *
 * Returns null for admin (no filter needed).
 * Returns impossible filter for empty scope (no access).
 */
export function buildScopeFilter(
  scope: DataScope | null | undefined,
): Record<string, unknown> | null {
  // null scope = admin, no filtering
  if (scope === null || scope === undefined) return null;

  const conditions: Record<string, unknown>[] = [];

  if (scope.userIds.length > 0) {
    conditions.push({ investigatorId: { in: scope.userIds } });
  }

  if (scope.teamIds.length > 0) {
    conditions.push({ assignedTeamId: { in: scope.teamIds } });
    // Include unassigned records visible to teams
    conditions.push({ assignedTeamId: null });
  }

  // Empty scope = no access
  if (conditions.length === 0) {
    return { id: '__no_access__' };
  }

  return { OR: conditions };
}

/**
 * Build Prisma where-clause filter for Petition scope.
 * Uses enteredById for ownership instead of investigatorId.
 */
export function buildPetitionScopeFilter(
  scope: DataScope | null | undefined,
): Record<string, unknown> | null {
  if (scope === null || scope === undefined) return null;

  const conditions: Record<string, unknown>[] = [];

  if (scope.userIds.length > 0) {
    conditions.push({ enteredById: { in: scope.userIds } });
  }

  if (scope.teamIds.length > 0) {
    conditions.push({ assignedTeamId: { in: scope.teamIds } });
    conditions.push({ assignedTeamId: null });
  }

  if (conditions.length === 0) {
    return { id: '__no_access__' };
  }

  return { OR: conditions };
}
