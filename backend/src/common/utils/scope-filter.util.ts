import { ForbiddenException } from '@nestjs/common';
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

/**
 * Throws 403 if the child record's parent (Case or Incident) is out of scope.
 * Pass the parent object (from an include) containing assignedTeamId + investigatorId.
 * If parent is null/undefined (orphan record), check passes silently.
 */
export function assertParentInScope(
  parent: { assignedTeamId?: string | null; investigatorId?: string | null } | null | undefined,
  scope: DataScope | null | undefined,
): void {
  if (!scope) return;
  if (!parent) return;
  const { userIds, teamIds } = scope;
  const ownerMatch = parent.investigatorId ? userIds.includes(parent.investigatorId) : false;
  const teamMatch = parent.assignedTeamId ? teamIds.includes(parent.assignedTeamId) : false;
  const unassigned = !parent.assignedTeamId && teamIds.length > 0;
  if (!ownerMatch && !teamMatch && !unassigned) {
    throw new ForbiddenException('Bạn không có quyền truy cập bản ghi này');
  }
}

/**
 * Throws 403 if the record's createdById is not in the user's allowed userIds.
 * Used for resources that have no caseId/teamId scope field.
 */
export function assertCreatorInScope(
  createdById: string | null | undefined,
  scope: DataScope | null | undefined,
): void {
  if (!scope) return;
  const { userIds } = scope;
  if (createdById && userIds.length > 0 && !userIds.includes(createdById)) {
    throw new ForbiddenException('Bạn không có quyền truy cập bản ghi này');
  }
}
