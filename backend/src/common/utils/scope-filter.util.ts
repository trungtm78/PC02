import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { DataScope } from '../../auth/services/unit-scope.service';
import {
  preciseAllows,
  preciseAllowsCreator,
  preciseConditions,
  type PreciseScope,
  type RecordSubject,
} from './precise-scope';

export const FORBIDDEN_MSG = 'Bạn không có quyền truy cập bản ghi này';
const NO_ACCESS_SENTINEL = '__no_access__';

// Sprint 3 / S3.3 — module-level metrics hook. Service-level inject sẽ khó vì
// scope-filter là pure utility. Wire qua module-level singleton (set bởi
// metrics.service onModuleInit) — keep utility pure cho test.
let denialCounter: { inc: (labels: { resource: string }) => void } | null =
  null;
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

/** Reading uses the read scope; changing and assigning use the write scope. */
const preciseOp = (op: ThaoTacPhamVi): 'read' | 'write' => (op === 'read' ? 'read' : 'write');

/**
 * The precise scopes to apply for a Case/Incident helper. Callers say which subject the records are; one that does
 * not is held to BOTH (a record must be within the Case scope and the Incident scope): never wider than either.
 */
function preciseFor(scope: DataScope, op: ThaoTacPhamVi, subject: RecordSubject | undefined): PreciseScope[] {
  const subjects = scope.precise!.subjects;
  const which: RecordSubject[] = subject ? [subject] : ['Case', 'Incident'];
  return which.map((s) => subjects[s][preciseOp(op)]);
}

/** The where-clause of precise scopes: every one of them must allow the record. */
function preciseFilter(scopes: PreciseScope[], userId: string, ownerField: string): Record<string, unknown> | null {
  const parts: Record<string, unknown>[] = [];
  for (const scope of scopes) {
    const conditions = preciseConditions(scope, userId, ownerField);
    if (conditions === null) continue;
    if (conditions.length === 0) return { id: NO_ACCESS_SENTINEL };
    parts.push({ OR: conditions });
  }
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : { AND: parts };
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
  subject?: 'Case' | 'Incident',
): Record<string, unknown> | null {
  // null scope = admin, no filtering
  if (scope === null || scope === undefined) return null;
  if (dieuPhoiBoQua(scope, op)) return null;
  if (scope.precise) return preciseFilter(preciseFor(scope, op, subject), scope.precise.userId, 'investigatorId');

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
  if (scope.precise) {
    return preciseFilter([scope.precise.subjects.Petition[preciseOp(op)]], scope.precise.userId, 'enteredById');
  }

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
 * Pass `subject` ('Case' or 'Incident') so that, when permissions by team are enforced, the parent is measured
 * against the right subject's scope; without it the parent must be within both. A petition is never checked here:
 * see `assertSourceInScope`.
 */
export function assertParentInScope(
  parent:
    | {
        assignedTeamId?: string | null;
        investigatorId?: string | null;
        intakeStage?: string | null;
      }
    | null
    | undefined,
  scope: DataScope | null | undefined,
  operation: 'read' | 'write' = 'read',
  subject?: 'Case' | 'Incident',
): void {
  if (operation === 'write' && parent?.intakeStage === 'CHO_NHAN')
    throw new ConflictException('Pending handoff protects this case');
  if (!scope) return;
  // Điều phối viên chỉ được bỏ qua phạm vi khi ĐỌC (quyết định 19/09/2026).
  if (scope.canDispatch && operation === 'read') return;
  // P0-001 fix: null parent = orphan record (caseId+incidentId both null on Document/VKS/ActionPlan/Delegation).
  // Previously: silent pass → cross-tenant data leak. Now: deny by default. Admin (scope=null) bypassed above.
  if (!parent) {
    recordDenial('parent-null');
    throw new ForbiddenException(
      operation === 'write'
        ? 'Bạn không có quyền chỉnh sửa bản ghi này'
        : FORBIDDEN_MSG,
    );
  }
  if (scope.precise) {
    const { userId } = scope.precise;
    const record = { assignedTeamId: parent.assignedTeamId, ownerId: parent.investigatorId };
    if (preciseFor(scope, operation, subject).every((p) => preciseAllows(p, userId, record))) return;
    recordDenial('parent');
    throw new ForbiddenException(
      operation === 'write'
        ? 'Bạn không có quyền chỉnh sửa bản ghi này'
        : FORBIDDEN_MSG,
    );
  }
  const { teamIds: effectiveTeamIds, userIds } = phamViTheoThaoTac(
    scope,
    operation,
  );
  const ownerMatch = parent.investigatorId
    ? userIds.includes(parent.investigatorId)
    : false;
  const teamMatch = parent.assignedTeamId
    ? effectiveTeamIds.includes(parent.assignedTeamId)
    : false;
  // v0.33.0.0 codex HIGH 5: ward officer KHÔNG được pass unassigned parent (same logic as buildScopeFilter)
  const isWardOfficer = scope.isWardOfficer === true;
  const unassigned =
    !parent.assignedTeamId && effectiveTeamIds.length > 0 && !isWardOfficer;
  if (!ownerMatch && !teamMatch && !unassigned) {
    recordDenial('parent');
    throw new ForbiddenException(
      operation === 'write'
        ? 'Bạn không có quyền chỉnh sửa bản ghi này'
        : FORBIDDEN_MSG,
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
  parent:
    | { assignedTeamId?: string | null; enteredById?: string | null }
    | null
    | undefined,
  scope: DataScope | null | undefined,
  operation: 'read' | 'write' = 'read',
): void {
  if (!scope) return;
  // Điều phối viên chỉ được bỏ qua phạm vi khi ĐỌC (quyết định 19/09/2026).
  if (scope.canDispatch && operation === 'read') return;
  if (!parent) {
    recordDenial('petition-parent-null');
    throw new ForbiddenException(
      operation === 'write'
        ? 'Bạn không có quyền chỉnh sửa bản ghi này'
        : FORBIDDEN_MSG,
    );
  }
  if (scope.precise) {
    const allowed = preciseAllows(scope.precise.subjects.Petition[operation], scope.precise.userId, {
      assignedTeamId: parent.assignedTeamId,
      ownerId: parent.enteredById,
    });
    if (allowed) return;
    recordDenial('petition-parent');
    throw new ForbiddenException(
      operation === 'write'
        ? 'Bạn không có quyền chỉnh sửa bản ghi này'
        : FORBIDDEN_MSG,
    );
  }
  const { teamIds: effectiveTeamIds, userIds } = phamViTheoThaoTac(
    scope,
    operation,
  );
  const ownerMatch = parent.enteredById
    ? userIds.includes(parent.enteredById)
    : false;
  const teamMatch = parent.assignedTeamId
    ? effectiveTeamIds.includes(parent.assignedTeamId)
    : false;
  const isWardOfficer = scope.isWardOfficer === true;
  const unassigned =
    !parent.assignedTeamId && effectiveTeamIds.length > 0 && !isWardOfficer;
  if (!ownerMatch && !teamMatch && !unassigned) {
    recordDenial('petition-parent');
    throw new ForbiddenException(
      operation === 'write'
        ? 'Bạn không có quyền chỉnh sửa bản ghi này'
        : FORBIDDEN_MSG,
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
  if (scope.precise) {
    // These records (exchanges, guidance, a delegation or proposal with no case) hang off case work: they are
    // reached as far as the person reaches cases.
    if (preciseAllowsCreator(scope.precise.subjects.Case[operation], scope.precise.userId, createdById)) return;
    recordDenial('creator');
    throw new ForbiddenException(
      operation === 'write'
        ? 'Bạn không có quyền chỉnh sửa bản ghi này'
        : FORBIDDEN_MSG,
    );
  }
  const { teamIds: effectiveTeamIds, userIds } = phamViTheoThaoTac(
    scope,
    operation,
  );
  const isDenyAll = userIds.length === 0 && effectiveTeamIds.length === 0;
  if (isDenyAll || (userIds.length > 0 && !userIds.includes(createdById))) {
    recordDenial('creator');
    throw new ForbiddenException(
      operation === 'write'
        ? 'Bạn không có quyền chỉnh sửa bản ghi này'
        : FORBIDDEN_MSG,
    );
  }
}

/**
 * Checks the record a case is created from, or that is being removed as a case's source: an Incident or a Petition.
 *
 * Today both are measured the same way (the person the record is assigned to counts as its owner). When permissions
 * by team are enforced a petition is measured like every other petition check: by WHO ENTERED IT, against the
 * Petition scope; the two rules must not disagree about the same petition.
 */
export function assertSourceInScope(
  source:
    | { kind: 'Incident'; assignedTeamId?: string | null; investigatorId?: string | null }
    | { kind: 'Petition'; assignedTeamId?: string | null; assignedToId?: string | null; enteredById?: string | null },
  scope: DataScope | null | undefined,
  operation: 'read' | 'write' = 'read',
): void {
  if (source.kind === 'Petition') {
    if (scope?.precise) {
      assertPetitionParentInScope({ assignedTeamId: source.assignedTeamId, enteredById: source.enteredById }, scope, operation);
      return;
    }
    // Legacy rule, unchanged: the lists decide, and they are the same for every subject.
    assertParentInScope({ assignedTeamId: source.assignedTeamId, investigatorId: source.assignedToId }, scope, operation, 'Incident');
    return;
  }
  assertParentInScope({ assignedTeamId: source.assignedTeamId, investigatorId: source.investigatorId }, scope, operation, 'Incident');
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// One place that reads the lists of a scope. Services ask these; they do not read `teamIds`, `userIds`,
// `writableTeamIds` or `writableUserIds` themselves (gate: `scope-fields.gate.spec.ts`), because the lists are not
// the truth once permissions by team are enforced: `scope.precise` is.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The field that says who owns a record of each subject. */
const OWNER_FIELD: Record<RecordSubject, string> = { Case: 'investigatorId', Incident: 'investigatorId', Petition: 'enteredById' };

/**
 * The conditions (to be OR-ed) under which a record of `subject` is within the scope for `op`.
 * `null` = no restriction (admin, or a dispatcher reading / assigning); `[]` = nothing at all.
 * The same rule as `buildScopeFilter` / `buildPetitionScopeFilter`, for callers that compose the conditions.
 */
export function scopeConditions(
  scope: DataScope | null | undefined,
  op: ThaoTacPhamVi,
  subject: RecordSubject,
): Record<string, unknown>[] | null {
  if (!scope) return null;
  if (dieuPhoiBoQua(scope, op)) return null;
  const ownerField = OWNER_FIELD[subject];
  if (scope.precise) return preciseConditions(scope.precise.subjects[subject][preciseOp(op)], scope.precise.userId, ownerField);
  const { teamIds, userIds } = phamViTheoThaoTac(scope, op);
  const conditions: Record<string, unknown>[] = [];
  if (userIds.length > 0) conditions.push({ [ownerField]: { in: userIds } });
  if (teamIds.length > 0) {
    conditions.push({ assignedTeamId: { in: teamIds } });
    if (!scope.isWardOfficer) conditions.push({ assignedTeamId: null });
  }
  return conditions;
}

/**
 * Whether one record in hand is within the scope. `ownerId` is the record's owner (the investigator of a case or an
 * incident, the person who entered a petition). A dispatcher reads everything and changes only within reach.
 */
export function recordInScope(
  record: { assignedTeamId?: string | null; ownerId?: string | null },
  scope: DataScope | null | undefined,
  op: 'read' | 'write',
  subject: RecordSubject,
): boolean {
  if (!scope) return true;
  if (scope.canDispatch && op === 'read') return true;
  if (scope.precise) return preciseAllows(scope.precise.subjects[subject][op], scope.precise.userId, record);
  const { teamIds, userIds } = phamViTheoThaoTac(scope, op);
  if (record.ownerId && userIds.includes(record.ownerId)) return true;
  if (record.assignedTeamId && teamIds.includes(record.assignedTeamId)) return true;
  return !record.assignedTeamId && teamIds.length > 0 && scope.isWardOfficer !== true;
}

/**
 * The teams whose records of `subject` the scope reaches for `op`; `null` = every team. Raw: a dispatcher is NOT
 * special here (callers that let a dispatcher read everything say so themselves).
 */
export function scopeTeamIds(
  scope: DataScope | null | undefined,
  op: 'read' | 'write',
  subject: RecordSubject,
): string[] | null {
  if (!scope) return null;
  if (scope.precise) {
    const p = scope.precise.subjects[subject][op];
    return p.all ? null : [...new Set([...p.exactTeamIds, ...(p.tree?.teamIds ?? [])])];
  }
  return phamViTheoThaoTac(scope, op).teamIds;
}

/** Whether `teamId` is one of those teams (a destination team must be within reach to move a record there). */
export function teamInScope(teamId: string, scope: DataScope | null | undefined, op: 'read' | 'write', subject: RecordSubject): boolean {
  const teams = scopeTeamIds(scope, op, subject);
  return teams === null || teams.includes(teamId);
}

/**
 * Whether records owned by `userId` are within reach for `op` whatever team they sit in: the person themselves, and
 * the people of the teams reached "as today". Used where a decision is about a PERSON (acting on a user's records,
 * granting them access), measured on case work.
 */
export function userInScope(userId: string, scope: DataScope | null | undefined, op: 'read' | 'write'): boolean {
  if (!scope) return true;
  if (scope.precise) {
    const p = scope.precise.subjects.Case[op];
    return p.all || userId === scope.precise.userId || (p.tree?.userIds.includes(userId) ?? false);
  }
  return phamViTheoThaoTac(scope, op).userIds.includes(userId);
}

/**
 * The list filter of records known only by who created them (exchanges, guidance, a delegation or proposal with no
 * case). `null` = no restriction; otherwise ONE condition to AND.
 *
 * `dispatcherSeesAll`: whether a dispatcher is unrestricted here (the lists differ on this today, and keep doing so).
 * `whenTeamOnly`: what somebody with teams but no people in scope sees today: every record that has a creator
 * ('has-creator'), or every record ('all').
 */
export function creatorFilter(
  scope: DataScope | null | undefined,
  op: 'read' | 'write',
  options: { dispatcherSeesAll: boolean; whenTeamOnly: 'has-creator' | 'all' },
): Record<string, unknown> | null {
  if (!scope) return null;
  if (options.dispatcherSeesAll && scope.canDispatch) return null;
  if (scope.precise) {
    const p = scope.precise.subjects.Case[op];
    if (p.all) return null;
    const people = new Set(p.tree?.userIds ?? []);
    if (p.own || p.exactTeamIds.length > 0 || p.tree) people.add(scope.precise.userId);
    return people.size > 0 ? { createdById: { in: [...people] } } : { id: NO_ACCESS_SENTINEL };
  }
  const { teamIds, userIds } = phamViTheoThaoTac(scope, op);
  if (userIds.length === 0 && teamIds.length === 0) return { id: NO_ACCESS_SENTINEL };
  if (userIds.length > 0) return { createdById: { in: userIds } };
  return options.whenTeamOnly === 'has-creator' ? { createdById: { not: null } } : null;
}

/** True for the filter the helpers return to say "nothing at all" (so callers need not know how it is spelled). */
export function isNoAccessFilter(filter: Record<string, unknown> | null | undefined): boolean {
  return !!filter && filter.id === NO_ACCESS_SENTINEL;
}

/** True when the scope reaches nothing at all: no record of any subject, for reading. */
export function scopeIsEmpty(scope: DataScope | null | undefined): boolean {
  if (!scope) return false;
  if (scope.precise) {
    return Object.values(scope.precise.subjects).every(
      ({ read }) => !read.all && !read.own && read.exactTeamIds.length === 0 && read.tree === null,
    );
  }
  return scope.userIds.length === 0 && scope.teamIds.length === 0;
}

