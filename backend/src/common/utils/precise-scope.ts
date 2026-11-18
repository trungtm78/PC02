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

/**
 * The kinds of record that carry a team and an owner of their own. `WardAssignment` is a ward or commune police unit's
 * request for an investigator to be assigned, decided by PC02: its team is the ward unit's, its owner the person who
 * entered it. Each subject is one resource of the permission catalogue (gate: `permission-resources.gate.spec.ts`).
 */
export const RECORD_SUBJECTS = ['Case', 'Incident', 'Petition', 'WardAssignment'] as const;
export type RecordSubject = (typeof RECORD_SUBJECTS)[number];

/**
 * Operations of a subject that reach records as far as THEIR OWN permission does (`review:WardAssignment`), not as
 * far as editing does. Reviewing a ward unit's request is a decision of PC02 over records it does not edit: a reviewer
 * holds `review` over every ward unit and no `edit` at all, and a ward officer holds `edit` over its own unit's
 * requests and no `review`. Deriving the reach of a review from `edit` would give the first nothing and the second the
 * power to decide on their own request.
 */
export const SCOPED_ACTIONS = { WardAssignment: ['review', 'matchSubjects'] } as const satisfies Partial<Record<RecordSubject, readonly string[]>>;
export type ScopedAction = (typeof SCOPED_ACTIONS)[keyof typeof SCOPED_ACTIONS][number];

/**
 * Subjects whose records are reached by their TEAM, never by who entered them: being a member of a team does not
 * carry into it the records that member entered for another unit. A ward unit's request belongs to the ward unit;
 * somebody who sits in wards W and V and enters a request for V must not hand it to everybody of W ("as today" of the
 * other subjects reaches the records of the team's people). "Own records only" (OWN) remains a grant of its own.
 */
export const TEAM_BOUND_SUBJECTS: ReadonlySet<RecordSubject> = new Set<RecordSubject>(['WardAssignment']);

/** A precise scope with its reach through people removed: what a team-bound subject is reached by. */
export function teamBound(scope: PreciseScope): PreciseScope {
  return scope.tree ? { ...scope, tree: { ...scope.tree, userIds: [] } } : scope;
}

/** The reach of one subject: for seeing, for changing, and for each scoped action it has (absent = nothing). */
export interface SubjectScopes {
  read: PreciseScope;
  write: PreciseScope;
  actions?: Partial<Record<ScopedAction, PreciseScope>>;
}

/** Present on a `DataScope` only when permissions by team are enforced. */
export interface PreciseScopes {
  /** The person the scopes were computed for: "own records" are theirs. */
  userId: string;
  subjects: Record<RecordSubject, SubjectScopes>;
  /**
   * The person holds `intake:WardAssignment` (the shared desk at PC02): they enter a ward request for ANY ward unit and
   * read only the requests they entered that were never submitted. Read by the ward module alone (`ward-locks.ts`);
   * absent for everybody else, so no other scope changes shape.
   */
  wardIntake?: true;
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
