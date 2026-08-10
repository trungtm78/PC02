import { ForbiddenException } from '@nestjs/common';
import type { DataScope } from '../../auth/services/unit-scope.service';

export const FORBIDDEN_MSG = 'Bạn không có quyền truy cập bản ghi này';
const NO_ACCESS_SENTINEL = '__no_access__';

// Sprint 3 / S3.3 — module-level metrics hook. Service-level inject sẽ khó vì
// scope-filter là pure utility. Wire qua module-level singleton (set bởi
// metrics.service onModuleInit) — keep utility pure cho test.
let denialCounter: { inc: (labels: { resource: string }) => void } | null = null;
export function setScopeDenialCounter(counter: typeof denialCounter): void {
  denialCounter = counter;
}
function recordDenial(resource: string): void {
  try {
    denialCounter?.inc({ resource });
  } catch {
    // never fail security gate due to metrics issue
  }
}

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
  // dispatcher: full read access — sees all records regardless of team
  if (scope.canDispatch) return null;

  const conditions: Record<string, unknown>[] = [];

  if (scope.userIds.length > 0) {
    conditions.push({ investigatorId: { in: scope.userIds } });
  }

  if (scope.teamIds.length > 0) {
    conditions.push({ assignedTeamId: { in: scope.teamIds } });
    // v0.33.0.0 codex Crit 1: ward officer EXCLUDED từ intake (unassigned records).
    // Cán bộ phường chỉ thấy records assignedTeamId IN ward team mình.
    // PC02 user (non-ward) vẫn thấy intake để claim/assign.
    if (!scope.isWardOfficer) {
      conditions.push({ assignedTeamId: null });
    }
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
  if (scope.canDispatch) return null;

  const conditions: Record<string, unknown>[] = [];

  if (scope.userIds.length > 0) {
    conditions.push({ enteredById: { in: scope.userIds } });
  }

  if (scope.teamIds.length > 0) {
    conditions.push({ assignedTeamId: { in: scope.teamIds } });
    // v0.33.0.0 codex Crit 1: ward officer EXCLUDED từ intake — same as buildScopeFilter
    if (!scope.isWardOfficer) {
      conditions.push({ assignedTeamId: null });
    }
  }

  if (conditions.length === 0) {
    return { id: NO_ACCESS_SENTINEL };
  }

  return { OR: conditions };
}

/**
 * Does `canDispatch` let this operation through?
 *
 * `canDispatch` is defined as "read all + assign/reassign any record"
 * (`unit-scope.service.ts`). It was short-circuiting writes too, which gave
 * every dispatcher create/edit/delete/restore rights over all 12 scoped
 * resources — far past what the flag is meant to grant, and invisible because
 * nothing ever denied them.
 *
 * Assignment does not depend on this bypass: `PATCH /:id/assign` and the three
 * bulk-assign endpoints have their own `DispatchGuard`, and `assignCase()` does
 * not take a scope at all. So writes fall through to the ordinary team and
 * owner checks.
 */
function dispatcherMayBypass(
  scope: DataScope,
  operation: 'read' | 'write',
): boolean {
  return scope.canDispatch === true && operation === 'read';
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
  if (dispatcherMayBypass(scope, operation)) return;
  // P0-001 fix: null parent = orphan record (caseId+incidentId both null on Document/VKS/ActionPlan/Delegation).
  // Previously: silent pass → cross-tenant data leak. Now: deny by default. Admin (scope=null) bypassed above.
  if (!parent) {
    recordDenial('parent-null');
    throw new ForbiddenException(
      operation === 'write' ? 'Bạn không có quyền chỉnh sửa bản ghi này' : FORBIDDEN_MSG,
    );
  }
  const { userIds, teamIds, writableTeamIds } = scope;
  const effectiveTeamIds = operation === 'write' ? (writableTeamIds ?? teamIds) : teamIds;
  const ownerMatch = parent.investigatorId ? userIds.includes(parent.investigatorId) : false;
  const teamMatch = parent.assignedTeamId ? effectiveTeamIds.includes(parent.assignedTeamId) : false;
  // v0.33.0.0 codex HIGH 5: ward officer KHÔNG được pass unassigned parent (same logic as buildScopeFilter)
  const isWardOfficer = (scope as any).isWardOfficer === true;
  const unassigned = !parent.assignedTeamId && effectiveTeamIds.length > 0 && !isWardOfficer;
  if (!ownerMatch && !teamMatch && !unassigned) {
    recordDenial('parent');
    throw new ForbiddenException(
      operation === 'write' ? 'Bạn không có quyền chỉnh sửa bản ghi này' : FORBIDDEN_MSG,
    );
  }
}

/**
 * Throws 403 if the Petition parent is out of scope.
 * Uses enteredById (creator) instead of investigatorId — Petition has no investigatorId field.
 * Mirrors assertParentInScope semantics: null parent denies, ward officer cannot pass unassigned,
 * write operation uses writableTeamIds.
 */
export function assertPetitionParentInScope(
  parent: { assignedTeamId?: string | null; enteredById?: string | null } | null | undefined,
  scope: DataScope | null | undefined,
  operation: 'read' | 'write' = 'read',
): void {
  if (!scope) return;
  if (dispatcherMayBypass(scope, operation)) return;
  if (!parent) {
    recordDenial('petition-parent-null');
    throw new ForbiddenException(
      operation === 'write' ? 'Bạn không có quyền chỉnh sửa bản ghi này' : FORBIDDEN_MSG,
    );
  }
  const { userIds, teamIds, writableTeamIds } = scope;
  const effectiveTeamIds = operation === 'write' ? (writableTeamIds ?? teamIds) : teamIds;
  const ownerMatch = parent.enteredById ? userIds.includes(parent.enteredById) : false;
  const teamMatch = parent.assignedTeamId ? effectiveTeamIds.includes(parent.assignedTeamId) : false;
  const isWardOfficer = (scope as any).isWardOfficer === true;
  const unassigned = !parent.assignedTeamId && effectiveTeamIds.length > 0 && !isWardOfficer;
  if (!ownerMatch && !teamMatch && !unassigned) {
    recordDenial('petition-parent');
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
  if (dispatcherMayBypass(scope, operation)) return;
  if (!createdById) {
    throw new ForbiddenException(FORBIDDEN_MSG);
  }
  const { userIds, teamIds, writableTeamIds } = scope;
  const effectiveTeamIds = operation === 'write' ? (writableTeamIds ?? teamIds) : teamIds;
  const isDenyAll = userIds.length === 0 && effectiveTeamIds.length === 0;
  if (isDenyAll || (userIds.length > 0 && !userIds.includes(createdById))) {
    recordDenial('creator');
    throw new ForbiddenException(
      operation === 'write' ? 'Bạn không có quyền chỉnh sửa bản ghi này' : FORBIDDEN_MSG,
    );
  }
}
