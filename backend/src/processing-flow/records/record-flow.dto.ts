import type { Prisma } from '@prisma/client';
import { bandOf, completionClass, remainingDays } from '../engine/bands';
import type { Band, CompletionClass, StepStatus } from '../engine/types';

/** The flow of a record with everything the tab shows, read in one query. */
export const RECORD_FLOW_INCLUDE = {
  flow: { select: { id: true, name: true } },
  version: { select: { id: true, versionNo: true } },
  steps: {
    orderBy: { order: 'asc' },
    include: {
      step: true,
      parties: { orderBy: { order: 'asc' }, include: { team: { select: { name: true } } } },
    },
  },
} satisfies Prisma.ProcRecordFlowInclude;

export type RecordFlowRow = Prisma.ProcRecordFlowGetPayload<{ include: typeof RECORD_FLOW_INCLUDE }>;

export interface RecordStepPartyDto {
  partyKind: string;
  teamId: string | null;
  teamName: string | null;
  role: string;
  assigneeUserId: string | null;
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
  /** The alert colour now, for a step being worked. `NONE` for every other step. */
  band: Band;
  /** Civil days left (negative once past); `null` when the step has no deadline or is not being worked. */
  remainingDays: number | null;
  /** For a step that has a deadline: done on time / late, or still open in time / overdue. */
  completion: CompletionClass | null;
  provisional: boolean;
  problem: string | null;
  deadlineRevision: number;
  upstreamReopened: boolean;
  doneAt: string | null;
  skippedAt: string | null;
  skippedFrom: StepStatus | null;
  revision: number;
  parties: RecordStepPartyDto[];
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
  revision: number;
  steps: RecordStepDto[];
}

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

const earlier = (a: Date | null, b: Date | null): Date | null => (a && b ? (a.getTime() <= b.getTime() ? a : b) : (a ?? b));

/** The flow of a record as the tab shows it. `now` decides the colours; nothing else here reads a clock. */
export function toRecordFlowDto(row: RecordFlowRow, now: Date): RecordFlowDto {
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
    revision: row.revision,
    steps: row.steps.map((step) => {
      const due = earlier(step.regulatoryDueAt, step.internalDueAt);
      const working = step.status === 'OPEN' || step.status === 'REPORTED';
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
        band: working && due ? bandOf(now, due, thresholds) : 'NONE',
        remainingDays: working && due ? remainingDays(now, due) : null,
        completion: due && step.status !== 'SKIPPED' && step.status !== 'WAITING_ANCHOR' ? completionClass(step.doneAt, due, now) : null,
        provisional: step.provisional,
        problem: step.problem,
        deadlineRevision: step.deadlineRevision,
        upstreamReopened: step.upstreamReopened,
        doneAt: iso(step.doneAt),
        skippedAt: iso(step.skippedAt),
        skippedFrom: step.skippedFrom,
        revision: step.revision,
        parties: step.parties.map((party) => ({
          partyKind: party.partyKind,
          teamId: party.teamId,
          teamName: party.team?.name ?? null,
          role: party.role,
          assigneeUserId: party.assigneeUserId,
        })),
      };
    }),
  };
}
