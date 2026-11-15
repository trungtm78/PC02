import type { Prisma } from '@prisma/client';
import { actingForIds } from './processing-delegation';

/**
 * WHO a person is on a step, in ONE place. The write paths (`ProcessingResultsService`) refuse with these predicates and
 * the DTO of the record's flow tells the screen the same answers (`viewer`), so a form is never offered to a person the
 * server will refuse for their role.
 *
 * DELEGATION lives here too. A person who acts for somebody (an effective delegation: `effectiveDelegations`) counts on
 * a step wherever that somebody counts, as a named person or as a member / head of the party's unit, for the WORK of the
 * step: reporting and giving an opinion. Two things stay the person's OWN:
 *   - a role they hold themself always comes first: a write is recorded for another person (`onBehalfOf`) only when no
 *     role of their own allows it, and `teamOf` answers their own unit before the unit of the person they act for;
 *   - `memberOfPartyIds` / `leaderOfPartyIds` (taking the work, naming a person of the unit) never come from a
 *     delegation: a delegate does not assign.
 */

type Db = Pick<Prisma.TransactionClient, 'procRecordStepParty' | 'procDelegation' | 'user' | 'userTeam'>;

/** A party of a step the person has a part in, as the rules read it. */
export interface RolePartyRow {
  id: string;
  recordStepId: string;
  role: string;
  teamId: string | null;
  assigneeUserId: string | null;
  /** The membership rows, in the party's unit, of the person and of the people they act for (empty when only named). */
  team: { status: string; members: { userId: string; isLeader: boolean }[] } | null;
}

/** The parties a person has a part in, and for whom: themself, and the people they act for right now. */
export interface RoleParties {
  userId: string;
  /** The people the person acts for (`actingForIds`). */
  acting: readonly string[];
  rows: RolePartyRow[];
}

export interface StepRoles {
  has(role: string): boolean;
  leads(role: string): boolean;
  /** The unit the person acts through for any of `roles` (as its head when `asHead`): their own unit first. */
  teamOf(roles: readonly string[], asHead?: boolean): string | null;
  /**
   * The person a write that needs one of `roles` (as a head when `asHead`) is made FOR: `null` when a role of the
   * person's own allows it, otherwise the person they act for through whom they hold it.
   */
  onBehalfOf(roles: readonly string[], asHead?: boolean): string | null;
  /** The parties whose ACTIVE unit the person THEMSELF is a member of: where they may take the work themself. */
  memberOfPartyIds(): string[];
  /** The parties whose ACTIVE unit the person THEMSELF heads: where they may name anybody of the unit. */
  leaderOfPartyIds(): string[];
}

/**
 * The parties of these steps the person has a part in: through an ACTIVE unit they belong to, or by being named; and
 * the same for each person in `acting`. One query, whatever the number of steps.
 */
export async function loadRoleParties(db: Db, stepIds: string[], userId: string, acting: readonly string[] = []): Promise<RoleParties> {
  if (stepIds.length === 0) return { userId, acting, rows: [] };
  const ids = [userId, ...acting];
  const rows = await db.procRecordStepParty.findMany({
    where: { recordStepId: { in: stepIds }, OR: [{ assigneeUserId: { in: ids } }, { team: { status: 'ACTIVE', members: { some: { userId: { in: ids } } } } }] },
    select: { id: true, recordStepId: true, role: true, teamId: true, assigneeUserId: true, team: { select: { status: true, members: { where: { userId: { in: ids } }, select: { userId: true, isLeader: true } } } } },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
  return { userId, acting, rows };
}

/** The same, for a person at `now`: the people they act for are resolved here (the application clock). */
export async function loadRolePartiesAt(db: Db, stepIds: string[], userId: string, now: Date): Promise<RoleParties> {
  if (stepIds.length === 0) return { userId, acting: [], rows: [] };
  return loadRoleParties(db, stepIds, userId, await actingForIds(db, userId, now));
}

/**
 * The roles the person has on ONE step (`parties.rows` are the rows of that step): MAIN, CHECK, COORDINATE, INFORM.
 * `leads(role)`: they head a unit that holds that role. `teamOf`: the unit they act through.
 */
export function stepRolesOf(parties: RoleParties): StepRoles {
  const { userId, rows } = parties;
  const ids = [userId, ...parties.acting];
  const membersOf = (p: RolePartyRow) => (p.team?.status === 'ACTIVE' ? p.team.members : []);
  const ownMember = (p: RolePartyRow) => membersOf(p).some((m) => m.userId === userId);
  const ownLeader = (p: RolePartyRow) => membersOf(p).some((m) => m.userId === userId && m.isLeader);
  /** Every way the person holds one of `roles`: through whom (themself, or a person they act for), on which unit. */
  const holdings = (roles: readonly string[], asHead: boolean): Array<{ through: string; teamId: string | null }> =>
    rows
      .filter((p) => roles.includes(p.role))
      .flatMap((p) =>
        [
          // Being named makes a participant, never a head.
          ...(!asHead && p.assigneeUserId && ids.includes(p.assigneeUserId) ? [p.assigneeUserId] : []),
          ...membersOf(p)
            .filter((m) => !asHead || m.isLeader)
            .map((m) => m.userId),
        ].map((through) => ({ through, teamId: p.teamId })),
      );
  /** The person's own holding first, then the first one that comes from a delegation. */
  const best = (roles: readonly string[], asHead: boolean) => {
    const all = holdings(roles, asHead);
    return all.find((holding) => holding.through === userId) ?? all[0] ?? null;
  };
  return {
    has: (role) => holdings([role], false).length > 0,
    // Heading a unit is being its leader in the ACTIVE unit that holds the role; being named only makes a participant.
    leads: (role) => holdings([role], true).length > 0,
    teamOf: (roles, asHead = false) => best(roles, asHead)?.teamId ?? null,
    onBehalfOf: (roles, asHead = false) => {
      const holding = best(roles, asHead);
      return holding === null || holding.through === userId ? null : holding.through;
    },
    memberOfPartyIds: () => rows.filter(ownMember).map((p) => p.id),
    leaderOfPartyIds: () => rows.filter(ownLeader).map((p) => p.id),
  };
}

/** The roles a unit reports in: it works the step, or coordinates it. */
export const REPORTING_ROLES = ['MAIN', 'COORDINATE'] as const;

/** A report (progress or result) is written by a unit that works the step or coordinates it. */
export function mayReport(roles: StepRoles): boolean {
  return REPORTING_ROLES.some((role) => roles.has(role));
}

/** The kinds of opinion a person gives, in the order the screen offers them. */
export const SPEAKING_KINDS = ['SUPERVISOR', 'COORDINATE', 'CHECK'] as const;
export type SpeakingKind = (typeof SPEAKING_KINDS)[number];

/** The role a kind of opinion is given in: the supervisor speaks for the unit that works the step. */
export function roleOfOpinion(kind: string): string {
  return kind === 'SUPERVISOR' ? 'MAIN' : kind;
}

/** Whether a kind of opinion is given as the HEAD of the unit that holds its role. */
export function opinionNeedsHead(kind: string): boolean {
  return kind === 'SUPERVISOR';
}

/** An opinion of this kind is given by the head of the working unit (SUPERVISOR), or a unit that coordinates / checks. */
export function mayGiveOpinion(roles: StepRoles, kind: string): boolean {
  return roles.has(roleOfOpinion(kind)) && (!opinionNeedsHead(kind) || roles.leads('MAIN'));
}

/**
 * The leader's decision has no rule about the step's parties: whoever holds `approve:ProcessingStep` and has the RECORD
 * in their own scope decides. `inOwnScope` is the gateway's `canRead` WITHOUT the step rule, the question the decision
 * route asks before it runs: a person who opened the record only through a step (or a delegation) does not decide.
 */
export function mayDecide(inOwnScope: boolean): boolean {
  return inOwnScope;
}

/**
 * Naming a person BY PERMISSION (`assign:ProcessingStep`, rule 1 of `ProcessingAssignmentService`) needs the record in
 * the person's own scope too; heading the party's unit (`leaderOfPartyIds`) is the other way and needs no scope.
 */
export function mayAssignByScope(inOwnScope: boolean): boolean {
  return inOwnScope;
}

/** What the person looking at the record may do on a step BY THEIR ROLE; the route's permission is asked separately. */
export interface StepViewerDto {
  canReport: boolean;
  opinionKinds: SpeakingKind[];
  /** The record is in the person's OWN scope (not only opened through a step): the decision route will take them. */
  canApprove: boolean;
  /** The same fact for naming a person by the permission `assign:ProcessingStep`. */
  canAssignByScope: boolean;
  /** The parties of the step whose (active) unit the person belongs to. Never through a delegation. */
  memberOfPartyIds: string[];
  /** The parties of the step whose (active) unit the person heads. Never through a delegation. */
  leaderOfPartyIds: string[];
}

export function stepViewerOf(roles: StepRoles, inOwnScope: boolean): StepViewerDto {
  return {
    canReport: mayReport(roles),
    opinionKinds: SPEAKING_KINDS.filter((kind) => mayGiveOpinion(roles, kind)),
    canApprove: mayDecide(inOwnScope),
    canAssignByScope: mayAssignByScope(inOwnScope),
    memberOfPartyIds: roles.memberOfPartyIds(),
    leaderOfPartyIds: roles.leaderOfPartyIds(),
  };
}

/**
 * The viewer of every step of a flow at `now`, keyed by the step's row. `inOwnScope`: whether the RECORD is in the
 * person's own scope, asked ONCE per record by the caller (`RecordGateway.canRead` without `viaStep`).
 */
export async function loadStepViewers(db: Db, stepIds: string[], userId: string, now: Date, inOwnScope: boolean): Promise<Map<string, StepViewerDto>> {
  const parties = await loadRolePartiesAt(db, stepIds, userId, now);
  return new Map(stepIds.map((stepId) => [stepId, stepViewerOf(stepRolesOf({ ...parties, rows: parties.rows.filter((p) => p.recordStepId === stepId) }), inOwnScope)]));
}
