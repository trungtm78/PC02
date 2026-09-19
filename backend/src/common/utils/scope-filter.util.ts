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
 * Thao tác mà bộ lọc phục vụ. Quyết định của anh 19/09/2026 cho quyền ĐIỀU PHỐI (canDispatch): ngoài phạm vi của
 * mình chỉ được XEM (`read`) và PHÂN CÔNG (`assign`); `write` (sửa nội dung, xoá, xoá hàng loạt, tạo bản ghi
 * con) chỉ trong phạm vi GHI (`writableTeamIds` — không gồm tổ chỉ được cấp quyền xem).
 */
export type ThaoTacPhamVi = 'read' | 'write' | 'assign';

/** Điều phối viên được bỏ qua phạm vi ở thao tác này không. */
function dieuPhoiBoQua(scope: DataScope, op: ThaoTacPhamVi): boolean {
  return !!scope.canDispatch && op !== 'write';
}

/**
 * Tổ và người dùng để lọc: đọc theo `teamIds` / `userIds`; ghi và phân công (khi không được bỏ qua) theo
 * `writableTeamIds` / `writableUserIds`. `userIds` gồm cả thành viên tổ chỉ được cấp quyền XEM — so thao tác ghi
 * theo nó là quyền xem thành quyền ghi. Thiếu trường ghi → rỗng (dự phòng ĐÓNG, không lùi về phạm vi đọc).
 */
function phamViTheoThaoTac(
  scope: DataScope,
  op: ThaoTacPhamVi,
): { teamIds: string[]; userIds: string[] } {
  return op === 'read'
    ? { teamIds: scope.teamIds, userIds: scope.userIds }
    : {
        teamIds: scope.writableTeamIds ?? [],
        userIds: scope.writableUserIds ?? [],
      };
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
  op: ThaoTacPhamVi = 'read',
): Record<string, unknown> | null {
  // null scope = admin, no filtering
  if (scope === null || scope === undefined) return null;
  if (dieuPhoiBoQua(scope, op)) return null;

  const conditions: Record<string, unknown>[] = [];
  const { teamIds, userIds } = phamViTheoThaoTac(scope, op);

  if (userIds.length > 0) {
    conditions.push({ investigatorId: { in: userIds } });
  }

  if (teamIds.length > 0) {
    conditions.push({ assignedTeamId: { in: teamIds } });
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
  op: ThaoTacPhamVi = 'read',
): Record<string, unknown> | null {
  if (scope === null || scope === undefined) return null;
  if (dieuPhoiBoQua(scope, op)) return null;

  const conditions: Record<string, unknown>[] = [];
  const { teamIds, userIds } = phamViTheoThaoTac(scope, op);

  if (userIds.length > 0) {
    conditions.push({ enteredById: { in: userIds } });
  }

  if (teamIds.length > 0) {
    conditions.push({ assignedTeamId: { in: teamIds } });
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
  // Điều phối viên chỉ được bỏ qua phạm vi khi ĐỌC (quyết định 19/09/2026).
  if (scope.canDispatch && operation === 'read') return;
  // P0-001 fix: null parent = orphan record (caseId+incidentId both null on Document/VKS/ActionPlan/Delegation).
  // Previously: silent pass → cross-tenant data leak. Now: deny by default. Admin (scope=null) bypassed above.
  if (!parent) {
    recordDenial('parent-null');
    throw new ForbiddenException(
      operation === 'write' ? 'Bạn không có quyền chỉnh sửa bản ghi này' : FORBIDDEN_MSG,
    );
  }
  const { teamIds: effectiveTeamIds, userIds } = phamViTheoThaoTac(
    scope,
    operation,
  );
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
  // Điều phối viên chỉ được bỏ qua phạm vi khi ĐỌC (quyết định 19/09/2026).
  if (scope.canDispatch && operation === 'read') return;
  if (!parent) {
    recordDenial('petition-parent-null');
    throw new ForbiddenException(
      operation === 'write' ? 'Bạn không có quyền chỉnh sửa bản ghi này' : FORBIDDEN_MSG,
    );
  }
  const { teamIds: effectiveTeamIds, userIds } = phamViTheoThaoTac(
    scope,
    operation,
  );
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
  // Điều phối viên chỉ được bỏ qua phạm vi khi ĐỌC (quyết định 19/09/2026).
  if (scope.canDispatch && operation === 'read') return;
  if (!createdById) {
    throw new ForbiddenException(FORBIDDEN_MSG);
  }
  const { teamIds: effectiveTeamIds, userIds } = phamViTheoThaoTac(
    scope,
    operation,
  );
  const isDenyAll = userIds.length === 0 && effectiveTeamIds.length === 0;
  if (isDenyAll || (userIds.length > 0 && !userIds.includes(createdById))) {
    recordDenial('creator');
    throw new ForbiddenException(
      operation === 'write' ? 'Bạn không có quyền chỉnh sửa bản ghi này' : FORBIDDEN_MSG,
    );
  }
}
