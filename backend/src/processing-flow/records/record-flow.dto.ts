import type { Prisma } from '@prisma/client';
import { bandOf, completionClass, remainingDays } from '../engine/bands';
import type { Band, CompletionClass, StepStatus } from '../engine/types';

/** The flow of a record with everything the tab shows, read in one query. */
export const RECORD_FLOW_INCLUDE = {
  flow: { select: { id: true, name: true } },
  version: { select: { id: true, versionNo: true } },
  /** The open pause, if any: the clock of the record stands still while it is suspended. */
  pauses: { where: { to: null }, select: { from: true } },
  steps: {
    orderBy: { order: 'asc' },
    include: {
      step: true,
      parties: {
        orderBy: { order: 'asc' },
        include: {
          team: {
            select: {
              name: true,
              status: true,
              /** The heads of the unit: they answer for the step while nobody is named. */
              members: { where: { isLeader: true, user: { isActive: true } }, select: { userId: true, user: { select: { firstName: true, lastName: true, username: true } } }, orderBy: { userId: 'asc' } },
            },
          },
        },
      },
      /** The newest report and opinion that are still standing: the one-line summary of a step. */
      reports: { where: { withdrawnAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
      opinions: { where: { withdrawnAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  },
} satisfies Prisma.ProcRecordFlowInclude;

export type RecordFlowRow = Prisma.ProcRecordFlowGetPayload<{ include: typeof RECORD_FLOW_INCLUDE }>;

/** One person who answers for a party of a step. */
export interface ResponsiblePersonDto {
  userId: string;
  name: string;
}

export interface RecordStepPartyDto {
  /** The row of the party: what the assignment routes name. */
  id: string;
  partyKind: string;
  teamId: string | null;
  teamName: string | null;
  role: string;
  assigneeUserId: string | null;
  /** The name of the person named on the party; `null` when nobody is (or the person is gone). */
  assigneeName: string | null;
  /** Who answers for the party: the person named, otherwise the heads of its (active) unit. */
  responsible: ResponsiblePersonDto[];
  note: string | null;
}

/** What the DTO shows of people and is not on the rows of the flow: the names of the persons named on a party. */
export interface FlowPeople {
  names: Map<string, string>;
}

const NOBODY: FlowPeople = { names: new Map() };

interface NamedUser {
  firstName: string | null;
  lastName: string | null;
  username: string;
}

/** The name a person is shown by. */
export function displayNameOf(user: NamedUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username;
}

/** Reads the people a flow names and its rows do not carry. One query. */
export async function loadFlowPeople(db: Pick<Prisma.TransactionClient, 'user'>, row: RecordFlowRow): Promise<FlowPeople> {
  const ids = [...new Set(row.steps.flatMap((step) => step.parties.flatMap((party) => (party.assigneeUserId ? [party.assigneeUserId] : []))))];
  if (ids.length === 0) return NOBODY;
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, username: true } });
  return { names: new Map(users.map((user) => [user.id, displayNameOf(user)])) };
}

export interface RecordStepDto {
  stepKey: string;
  order: number;
  name: string;
  description: string | null;
  status: StepStatus;
  anchor: string;
  setsRecordDeadline: boolean;
  requiresApproval: boolean;
  legalBasis: string | null;
  /** The date the deadline is counted from; `null` while the step waits. */
  startAt: string | null;
  /** The deadline the law (or the flow) sets; it changes only by an extension. */
  regulatoryDueAt: string | null;
  /** The unit's own target, never later than the regulatory deadline. */
  internalDueAt: string | null;
  /** The earlier of the two: the one the colour counts down to. */
  dueAt: string | null;
  /** The instants the bands start at (from the earlier deadline): the Gantt chart draws its tail with them. */
  greenFrom: string | null;
  yellowFrom: string | null;
  redFrom: string | null;
  /** The alert thresholds of the step, in remaining civil days. */
  thresholds: { redDays: number; yellowDays: number; greenDays: number };
  /** The flow allows this many extensions, of this length (the step's own figures; a variant may differ). */
  extensionsAllowed: number;
  /** The alert colour now, for a step being worked. `NONE` for every other step, and for every step of a proposal. */
  band: Band;
  /** Civil days left (negative once past); `null` when the step has no deadline or is not being worked. */
  remainingDays: number | null;
  /** For a step that has a deadline: done on time / late, or still open in time / overdue. `null` under a proposal. */
  completion: CompletionClass | null;
  provisional: boolean;
  problem: string | null;
  deadlineRevision: number;
  /** How many times the regulatory deadline was extended. */
  extensionsUsed: number;
  upstreamReopened: boolean;
  doneAt: string | null;
  skippedAt: string | null;
  skippedFrom: StepStatus | null;
  revision: number;
  parties: RecordStepPartyDto[];
  /** The newest report still standing, cut short, and the newest opinion: the summary line of the step. */
  latestReport: { kind: string; summary: string; at: string; revision: number } | null;
  latestOpinion: { kind: string; verdict: string; at: string } | null;
}

export interface RecordFlowDto {
  id: string;
  recordKind: string;
  recordId: string;
  flowId: string;
  flowName: string;
  versionNo: number;
  match: string;
  /** `false`: the flow is only a proposal (the information type matched nothing); no legal deadline is asserted yet. */
  confirmed: boolean;
  acceptedAt: string | null;
  /** When the clock stopped, while the record is suspended; `null` otherwise. No colour is shown while it is set. */
  pausedSince: string | null;
  /** The record is suspended (its clock stands still, or is about to). */
  suspended: boolean;
  revision: number;
  steps: RecordStepDto[];
}

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

/** The deadline a step is judged against: the earlier of the regulatory one and the unit's own. */
export const earlier = (a: Date | null, b: Date | null): Date | null => (a && b ? (a.getTime() <= b.getTime() ? a : b) : (a ?? b));

/**
 * What the record itself says about its clock right now. `suspended`: whether or not the worker has opened the pause
 * yet, no colour is shown for a clock that is about to stand still. `finished`: nothing counts down on a record the
 * unit is done with, even if a step was left open.
 */
export interface RecordClock {
  suspended: boolean;
  finished: boolean;
}

const RUNNING: RecordClock = { suspended: false, finished: false };

/**
 * The flow of a record as the tab shows it. `now` decides the colours; nothing else here reads a clock. The colour of a
 * step and the stored alert of the record (`refreshRecordAlert`) follow the same rule: none while the record is
 * suspended or finished, or its clock is paused, or the flow is only a proposal (`confirmed = false`, decision C10): the
 * dates of a proposal are shown as what the flow WOULD set, and nothing is said to be near, overdue or late by them.
 */
export function toRecordFlowDto(row: RecordFlowRow, now: Date, clock: RecordClock = RUNNING, people: FlowPeople = NOBODY): RecordFlowDto {
  const { suspended, finished } = clock;
  return {
    id: row.id,
    recordKind: row.recordKind,
    recordId: row.recordId,
    flowId: row.flowId,
    flowName: row.flow.name,
    versionNo: row.version.versionNo,
    match: row.match,
    confirmed: row.confirmed,
    acceptedAt: iso(row.acceptedAt),
    pausedSince: iso(row.pauses[0]?.from ?? null),
    suspended: suspended || row.pauses.length > 0,
    revision: row.revision,
    steps: row.steps.map((step) => {
      const due = earlier(step.regulatoryDueAt, step.internalDueAt);
      // A deadline that is about to move (the record is suspended) has no colour: it would be wrong the moment it resumes.
      const working = row.confirmed && (step.status === 'OPEN' || step.status === 'REPORTED') && row.pauses.length === 0 && !suspended && !finished;
      const thresholds = { redDays: step.step.redDays, yellowDays: step.step.yellowDays, greenDays: step.step.greenDays };
      return {
        stepKey: step.stepKey,
        order: step.order,
        name: step.step.name,
        description: step.step.description,
        status: step.status,
        anchor: step.step.anchor,
        setsRecordDeadline: step.step.setsRecordDeadline,
        requiresApproval: step.step.requiresApproval,
        legalBasis: step.step.legalBasis,
        startAt: iso(step.startAt),
        regulatoryDueAt: iso(step.regulatoryDueAt),
        internalDueAt: iso(step.internalDueAt),
        dueAt: iso(due),
        greenFrom: iso(step.greenFrom),
        yellowFrom: iso(step.yellowFrom),
        redFrom: iso(step.redFrom),
        thresholds: thresholds,
        extensionsAllowed: step.step.maxExtensions,
        band: working && due ? bandOf(now, due, thresholds) : 'NONE',
        remainingDays: working && due ? remainingDays(now, due) : null,
        completion: row.confirmed && due && step.status !== 'SKIPPED' && step.status !== 'WAITING_ANCHOR' ? completionClass(step.doneAt, due, now) : null,
        provisional: step.provisional,
        problem: step.problem,
        deadlineRevision: step.deadlineRevision,
        extensionsUsed: step.extensionsUsed,
        upstreamReopened: step.upstreamReopened,
        doneAt: iso(step.doneAt),
        skippedAt: iso(step.skippedAt),
        skippedFrom: step.skippedFrom,
        revision: step.revision,
        latestReport: step.reports[0] ? { kind: step.reports[0].kind, summary: step.reports[0].doneWork.slice(0, 200), at: step.reports[0].createdAt.toISOString(), revision: step.reports[0].revision } : null,
        latestOpinion: step.opinions[0] ? { kind: step.opinions[0].kind, verdict: step.opinions[0].verdict, at: step.opinions[0].createdAt.toISOString() } : null,
        parties: step.parties.map((party) => {
          const assigneeName = party.assigneeUserId ? (people.names.get(party.assigneeUserId) ?? null) : null;
          const heads = party.team?.status === 'ACTIVE' ? party.team.members.map((member) => ({ userId: member.userId, name: displayNameOf(member.user) })) : [];
          return {
            id: party.id,
            partyKind: party.partyKind,
            teamId: party.teamId,
            teamName: party.team?.name ?? null,
            role: party.role,
            assigneeUserId: party.assigneeUserId,
            assigneeName,
            responsible: party.assigneeUserId ? [{ userId: party.assigneeUserId, name: assigneeName ?? '' }] : heads,
            note: party.note,
          };
        }),
      };
    }),
  };
}
