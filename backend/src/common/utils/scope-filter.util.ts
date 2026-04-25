import { ForbiddenException } from '@nestjs/common';
import type { DataScope } from '../../auth/services/unit-scope.service';

export const FORBIDDEN_MSG = 'Bạn không có quyền truy cập bản ghi này';
const NO_ACCESS_SENTINEL = '__no_access__';

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
    // Intake workflow: records not yet routed to a team are visible to all team members
    // so officers can claim/assign incoming cases from any unit.
    conditions.push({ assignedTeamId: null });
  }

  // Empty scope = no access
  if (conditions.length === 0) {
    return { id: NO_ACCESS_SENTINEL };
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
    // Intake workflow: unassigned petitions visible to all team members (same as buildScopeFilter).
    conditions.push({ assignedTeamId: null });
  }

  if (conditions.length === 0) {
    return { id: NO_ACCESS_SENTINEL };
  }

  return { OR: conditions };
}

/**
 * Throws 403 if the child record's parent (Case or Incident) is out of scope.
 * Pass the parent object (from an include) containing assignedTeamId + investigatorId.
 * If parent is null/undefined (orphan record), check passes silently.
 * Pass operation='write' on mutation paths — uses writableTeamIds instead of teamIds.
 */
export function assertParentInScope(
  parent: { assignedTeamId?: string | null; investigatorId?: string | null } | null | undefined,
  scope: DataScope | null | undefined,
  operation: 'read' | 'write' = 'read',
): void {
  if (!scope) return;
  if (!parent) return;
  const { userIds, teamIds, writableTeamIds } = scope;
  const effectiveTeamIds = operation === 'write' ? (writableTeamIds ?? teamIds) : teamIds;
  const ownerMatch = parent.investigatorId ? userIds.includes(parent.investigatorId) : false;
  const teamMatch = parent.assignedTeamId ? effectiveTeamIds.includes(parent.assignedTeamId) : false;
  const unassigned = !parent.assignedTeamId && effectiveTeamIds.length > 0;
  if (!ownerMatch && !teamMatch && !unassigned) {
    throw new ForbiddenException(
      operation === 'write' ? 'Bạn không có quyền chỉnh sửa bản ghi này' : FORBIDDEN_MSG,
    );
  }
}

/**
 * Throws 403 if the record's createdById is not in the user's allowed userIds.
 * Used for resources that have no caseId/teamId scope field.
 * Null/undefined createdById always denies (orphan records are not accessible to scoped users).
 * Deny-all scope ({ userIds: [], teamIds: [] }) always denies.
 * Team-only scope ({ userIds: [], teamIds: [...] }) allows (team leader sees all creator-anchored records).
 * Pass operation='write' on mutation paths — team bypass requires writableTeamIds instead of teamIds.
 */
export function assertCreatorInScope(
  createdById: string | null | undefined,
  scope: DataScope | null | undefined,
  operation: 'read' | 'write' = 'read',
): void {
  if (!scope) return;
  if (!createdById) {
    throw new ForbiddenException(FORBIDDEN_MSG);
  }
  const { userIds, teamIds, writableTeamIds } = scope;
  const effectiveTeamIds = operation === 'write' ? (writableTeamIds ?? teamIds) : teamIds;
  const isDenyAll = userIds.length === 0 && effectiveTeamIds.length === 0;
  if (isDenyAll || (userIds.length > 0 && !userIds.includes(createdById))) {
    throw new ForbiddenException(
      operation === 'write' ? 'Bạn không có quyền chỉnh sửa bản ghi này' : FORBIDDEN_MSG,
    );
  }
}
