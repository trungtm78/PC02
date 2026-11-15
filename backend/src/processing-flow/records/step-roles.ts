import type { Prisma } from '@prisma/client';

/**
 * WHO a person is on a step, in ONE place. The write paths (`ProcessingResultsService`) refuse with these predicates and
 * the DTO of the record's flow tells the screen the same answers (`viewer`), so a form is never offered to a person the
 * server will refuse for their role.
 */

type Db = Pick<Prisma.TransactionClient, 'procRecordStepParty'>;

/** A party of a step the person has a part in, as the rules read it. */
export interface RolePartyRow {
  id: string;
  recordStepId: string;
  role: string;
  teamId: string | null;
  assigneeUserId: string | null;
  /** The person's own membership rows of the party's unit (empty when they are only named). */
  team: { status: string; members: { isLeader: boolean }[] } | null;
}

export interface StepRoles {
  has(role: string): boolean;
  leads(role: string): boolean;
  teamOf(role?: string): string | null;
  /** The parties whose ACTIVE unit the person is a member of: where they may take the work themself. */
  memberOfPartyIds(): string[];
  /** The parties whose ACTIVE unit the person heads: where they may name anybody of the unit. */
  leaderOfPartyIds(): string[];
}

/**
 * The parties of these steps the person has a part in: through an ACTIVE unit they belong to, or by being named.
 * One query, whatever the number of steps.
 */
export async function loadRoleParties(db: Db, stepIds: string[], userId: string): Promise<RolePartyRow[]> {
  if (stepIds.length === 0) return [];
  return db.procRecordStepParty.findMany({
    where: { recordStepId: { in: stepIds }, OR: [{ assigneeUserId: userId }, { team: { status: 'ACTIVE', members: { some: { userId } } } }] },
    select: { id: true, recordStepId: true, role: true, teamId: true, assigneeUserId: true, team: { select: { status: true, members: { where: { userId }, select: { isLeader: true } } } } },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
}

/**
 * The roles the person has on ONE step: MAIN, CHECK, COORDINATE, INFORM. `leads(role)`: they head a unit that holds
 * that role. `teamOf(role)`: the unit they act through.
 */
export function stepRolesOf(parties: RolePartyRow[]): StepRoles {
  const memberOf = (p: RolePartyRow) => p.team?.status === 'ACTIVE' && p.team.members.length > 0;
  return {
    has: (role) => parties.some((p) => p.role === role),
    // Heading a unit is being its leader in the ACTIVE unit that holds the role; being named only makes a participant.
    leads: (role) => parties.some((p) => p.role === role && memberOf(p) && p.team?.members.some((m) => m.isLeader) === true),
    teamOf: (role) => parties.find((p) => !role || p.role === role)?.teamId ?? null,
    memberOfPartyIds: () => parties.filter(memberOf).map((p) => p.id),
    leaderOfPartyIds: () => parties.filter((p) => memberOf(p) && p.team?.members.some((m) => m.isLeader) === true).map((p) => p.id),
  };
}

/** A report (progress or result) is written by a unit that works the step or coordinates it. */
export function mayReport(roles: StepRoles): boolean {
  return roles.has('MAIN') || roles.has('COORDINATE');
}

/** The kinds of opinion a person gives, in the order the screen offers them. */
export const SPEAKING_KINDS = ['SUPERVISOR', 'COORDINATE', 'CHECK'] as const;
export type SpeakingKind = (typeof SPEAKING_KINDS)[number];

/** The role a kind of opinion is given in: the supervisor speaks for the unit that works the step. */
export function roleOfOpinion(kind: string): string {
  return kind === 'SUPERVISOR' ? 'MAIN' : kind;
}

/** An opinion of this kind is given by the head of the working unit (SUPERVISOR), or a unit that coordinates / checks. */
export function mayGiveOpinion(roles: StepRoles, kind: string): boolean {
  return roles.has(roleOfOpinion(kind)) && (kind !== 'SUPERVISOR' || roles.leads('MAIN'));
}

/**
 * The leader's decision has no rule about the step's parties: whoever holds `approve:ProcessingStep` and may open the
 * record decides. Kept here so that a rule added later is told to the screen by the same function.
 */
export function mayDecide(_roles: StepRoles): boolean {
  return true;
}

/** What the person looking at the record may do on a step BY THEIR ROLE; the route's permission is asked separately. */
export interface StepViewerDto {
  canReport: boolean;
  opinionKinds: SpeakingKind[];
  canApprove: boolean;
  /** The parties of the step whose (active) unit the person belongs to. */
  memberOfPartyIds: string[];
  /** The parties of the step whose (active) unit the person heads. */
  leaderOfPartyIds: string[];
}

export function stepViewerOf(roles: StepRoles): StepViewerDto {
  return {
    canReport: mayReport(roles),
    opinionKinds: SPEAKING_KINDS.filter((kind) => mayGiveOpinion(roles, kind)),
    canApprove: mayDecide(roles),
    memberOfPartyIds: roles.memberOfPartyIds(),
    leaderOfPartyIds: roles.leaderOfPartyIds(),
  };
}

/** The viewer of every step of a flow, keyed by the step's row. */
export async function loadStepViewers(db: Db, stepIds: string[], userId: string): Promise<Map<string, StepViewerDto>> {
  const parties = await loadRoleParties(db, stepIds, userId);
  return new Map(stepIds.map((stepId) => [stepId, stepViewerOf(stepRolesOf(parties.filter((p) => p.recordStepId === stepId)))]));
}
