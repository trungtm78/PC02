/**
 * How far a person reaches over the records of ONE subject, for ONE kind of operation, when permissions by team are
 * enforced. Plain data: the authz engine computes it (`authz/engine/scope.ts` `RecordScope`), the record filters
 * consume it, and neither imports the other.
 *
 * The four parts stay apart on purpose. "The team's records OR its members' records" is what `tree` means (today's
 * behaviour). If `own` or `exactTeamIds` were folded into that, a member of A handling a record assigned to B would
 * make it visible to all of A, and unassigned records would leak to people limited to their own.
 */
export interface PreciseScope {
  /** Every record. */
  all: boolean;
  /** Records the person owns (the owner field equals the person). */
  own: boolean;
  /** Records assigned to exactly these teams. */
  exactTeamIds: string[];
  /** "As today": records assigned to these teams, records owned by these people, and unassigned ones if said so. */
  tree: { teamIds: string[]; userIds: string[]; includeUnassigned: boolean } | null;
}

export const RECORD_SUBJECTS = ['Case', 'Incident', 'Petition'] as const;
export type RecordSubject = (typeof RECORD_SUBJECTS)[number];

/** Present on a `DataScope` only when permissions by team are enforced. */
export interface PreciseScopes {
  /** The person the scopes were computed for: "own records" are theirs. */
  userId: string;
  subjects: Record<RecordSubject, { read: PreciseScope; write: PreciseScope }>;
}

export const NOTHING: PreciseScope = { all: false, own: false, exactTeamIds: [], tree: null };

/** The Prisma conditions (to be OR-ed) a precise scope allows; `null` = no restriction; `[]` = nothing at all. */
export function preciseConditions(scope: PreciseScope, userId: string, ownerField: string): Record<string, unknown>[] | null {
  if (scope.all) return null;
  const conditions: Record<string, unknown>[] = [];
  if (scope.own) conditions.push({ [ownerField]: userId });
  if (scope.exactTeamIds.length > 0) conditions.push({ assignedTeamId: { in: scope.exactTeamIds } });
  if (scope.tree) {
    if (scope.tree.userIds.length > 0) conditions.push({ [ownerField]: { in: scope.tree.userIds } });
    if (scope.tree.teamIds.length > 0) conditions.push({ assignedTeamId: { in: scope.tree.teamIds } });
    if (scope.tree.includeUnassigned) conditions.push({ assignedTeamId: null });
  }
  return conditions;
}

/** Whether one record is within a precise scope. The same rule as `preciseConditions`, for a record in hand. */
export function preciseAllows(
  scope: PreciseScope,
  userId: string,
  record: { assignedTeamId?: string | null; ownerId?: string | null },
): boolean {
  if (scope.all) return true;
  if (scope.own && !!record.ownerId && record.ownerId === userId) return true;
  if (record.assignedTeamId && scope.exactTeamIds.includes(record.assignedTeamId)) return true;
  if (scope.tree) {
    if (record.ownerId && scope.tree.userIds.includes(record.ownerId)) return true;
    if (record.assignedTeamId && scope.tree.teamIds.includes(record.assignedTeamId)) return true;
    if (!record.assignedTeamId && scope.tree.includeUnassigned) return true;
  }
  return false;
}

/**
 * Whether a record known only by who created it (no team, no parent record) is within a precise scope: the person's
 * own, or a person's of the teams they reach "as today". "Exactly the team" says nothing about such a record.
 */
export function preciseAllowsCreator(scope: PreciseScope, userId: string, createdById: string): boolean {
  if (scope.all) return true;
  if (createdById === userId && (scope.own || scope.exactTeamIds.length > 0 || scope.tree !== null)) return true;
  return scope.tree?.userIds.includes(createdById) ?? false;
}
