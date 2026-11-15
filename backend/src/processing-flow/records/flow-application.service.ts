import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { readResolveConfig, STEP_INCLUDE, toFlowStep, type ResolveConfig } from '../config/flow-reader';
import { resolveFlow, type FlowResolution } from '../config/resolve-flow';
import { PROCESSING_ERROR } from '../contract/processing-codes';
import { civilDayOf, civilYearOf } from '../engine/civil-day';
import { buildWorkingCalendar, MAX_CALENDAR_YEAR } from '../engine/working-calendar';
import { ANCHOR_KEYS, type RecordKind, type RecordSnapshot } from '../gateway/record-snapshot';
import { RecordGateway } from '../gateway/record-gateway';
import { RecordDeadlineWriter } from './record-deadline-writer.service';
import { planRecordSteps, type RecordAnchors } from './schedule-step';

type Tx = Prisma.TransactionClient;

/** Why a flow is being applied: a record was saved, a record became another kind, a person asked, the CLI ran. */
export type ApplyReason = 'CREATED' | 'CONVERTED' | 'REAPPLY' | 'CLI';

export interface ApplyInput {
  kind: RecordKind;
  recordId: string;
  reason: ApplyReason;
  /** `null`: the system, after the record was saved. */
  actorId: string | null;
  /** A person chose this flow: it is used whatever the information type says. */
  flowId?: string;
}

export type ApplyOutcome =
  | { outcome: 'APPLIED'; recordFlowId: string; flowId: string; versionId: string; match: FlowResolution['match'] | 'MANUAL'; confirmed: boolean; steps: number }
  | { outcome: 'ALREADY_APPLIED'; recordFlowId: string }
  | { outcome: 'RECORD_GONE' }
  /** A finished record gets no steps: nothing is left to count down. */
  | { outcome: 'RECORD_FINISHED' }
  /** The configuration has no flow for the record (nothing bound, no default flow of its kind). */
  | { outcome: 'NO_FLOW' }
  | { outcome: 'NO_PUBLISHED_VERSION' };

/** Advisory-lock namespace for "the flow of one record" (7226010 is the lock of the flow configuration of a kind). */
export const RECORD_FLOW_LOCK = 7226020;

/** Years of calendar read beyond the last date the deadlines start from: a month-long duration can run past it. */
const CALENDAR_YEARS_AHEAD = 3;

/** The dates of a record that exist, as the planner reads them (the date of acceptance comes from the record's own flow). */
export function anchorsOf(snapshot: RecordSnapshot, acceptedAt: Date | null): RecordAnchors {
  const anchors: RecordAnchors = {};
  for (const key of ANCHOR_KEYS) {
    const anchor = snapshot.anchors[key];
    if (anchor.at) anchors[key] = { at: anchor.at, hasTime: anchor.hasTime };
  }
  // A day person recorded by hand: a calendar day, like every other date of a record except a petition's receiving time.
  if (acceptedAt && !anchors.ACCEPTED) anchors.ACCEPTED = { at: acceptedAt, hasTime: false };
  return anchors;
}

/**
 * Applies the flow the configuration has for a record to that record: pins the published version, makes the steps with
 * their stored deadlines and the units that work them, and writes what it did. One transaction, one lock per record,
 * and a second call for the same record changes nothing.
 *
 * It does not decide WHEN: the outbox (`ProcessingOutboxService`) calls it after a record is saved, a person calls it
 * for an existing record. A failure here is never a failure of saving the record.
 */
@Injectable()
export class FlowApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RecordGateway,
    private readonly calendars: WorkingCalendarService,
    private readonly audit: AuditService,
    private readonly deadlineWriter: RecordDeadlineWriter,
  ) {}

  async apply(input: ApplyInput): Promise<ApplyOutcome> {
    return this.prisma.$transaction(async (tx) => this.applyIn(tx, input), { timeout: 60_000, maxWait: 10_000 });
  }

  /** The same, inside the caller's transaction (the caller holds nothing else the record's lock waits on). */
  async applyIn(tx: Tx, input: ApplyInput): Promise<ApplyOutcome> {
    const { kind, recordId } = input;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RECORD_FLOW_LOCK}::int, hashtext(${`${kind}:${recordId}`})::int)`;

    const existing = await tx.procRecordFlow.findUnique({ where: { recordKind_recordId: { recordKind: kind, recordId } }, select: { id: true } });
    if (existing) return { outcome: 'ALREADY_APPLIED', recordFlowId: existing.id };

    const snapshot = await this.gateway.load(kind, recordId, tx);
    if (!snapshot) return { outcome: 'RECORD_GONE' };
    if (snapshot.isFinished) return { outcome: 'RECORD_FINISHED' };

    const config = await readResolveConfig(tx, kind);
    const chosen = input.flowId ? this.chosenFlow(config, kind, input.flowId) : null;
    const resolution: FlowResolution | null = chosen ?? resolveFlow({ recordKind: kind, informationType: snapshot.informationType }, config);
    if (!resolution) return { outcome: 'NO_FLOW' };
    const match = chosen ? 'MANUAL' : resolution.match;

    const flow = config.flows.find((candidate) => candidate.id === resolution.flowId);
    const version = flow?.versions[0];
    if (!flow || !version) return { outcome: 'NO_PUBLISHED_VERSION' };

    const rows = await tx.procFlowStep.findMany({ where: { versionId: version.id }, include: STEP_INCLUDE, orderBy: { order: 'asc' } });
    const anchors = anchorsOf(snapshot, null);
    const plan = planRecordSteps(rows.map(toFlowStep), anchors, snapshot.conditions, await this.calendarFor(tx, anchors));

    const unknown = match === 'UNKNOWN_TYPE';
    const recordFlow = await tx.procRecordFlow.create({
      data: {
        recordKind: kind,
        recordId,
        flowId: flow.id,
        versionId: version.id,
        match: match as Prisma.ProcRecordFlowCreateInput['match'],
        directoryId: resolution.directoryId ?? null,
        typeKey: resolution.typeKey ?? null,
        bindingId: bindingOf(config, resolution)?.id ?? null,
        conditions: Object.keys(snapshot.conditions).length ? (snapshot.conditions as Prisma.InputJsonObject) : undefined,
        confirmed: !unknown,
        appliedById: input.actorId,
      },
    });

    for (const [index, planned] of plan.entries()) {
      const row = rows[index];
      await tx.procRecordStep.create({
        data: {
          recordFlowId: recordFlow.id,
          recordKind: kind,
          recordId,
          stepId: row.id,
          stepKey: row.stepKey,
          order: index,
          status: planned.status,
          startAt: planned.startAt,
          // Both start as the same deadline: the internal one may only be set earlier later (a person's own target).
          regulatoryDueAt: planned.dueAt,
          internalDueAt: planned.dueAt,
          provisional: planned.provisional,
          calendarVersion: planned.calendarVersion,
          greenFrom: planned.greenFrom,
          yellowFrom: planned.yellowFrom,
          redFrom: planned.redFrom,
          variant: planned.variant,
          problem: planned.problem,
          parties: {
            create: row.parties.map((party, order) => ({
              partyKind: party.partyKind,
              // "The unit holding the record" becomes that unit now; a record with no unit yet leaves it empty.
              teamId: party.partyKind === 'TEAM' ? party.teamId : snapshot.assignedTeamId,
              role: party.role,
              note: party.note,
              order,
            })),
          },
        },
      });
    }

    await tx.procStepChange.create({
      data: {
        recordFlowId: recordFlow.id,
        recordKind: kind,
        recordId,
        action: 'FLOW_APPLIED',
        toValue: { flowId: flow.id, versionId: version.id, match, confirmed: !unknown, steps: plan.length, reason: input.reason },
        actorId: input.actorId,
      },
    });
    await this.audit.log(
      {
        userId: input.actorId ?? undefined,
        action: 'PROC_FLOW_APPLIED',
        subject: 'ProcRecordFlow',
        subjectId: recordFlow.id,
        // Metadata only: which flow, how it was found. No deadline, no text of the record.
        metadata: { recordKind: kind, recordId, flowId: flow.id, versionId: version.id, match, confirmed: !unknown, steps: plan.length, reason: input.reason },
      },
      tx,
    );
    // A flow that keeps the deadline of the record writes it now (a proposed or unverified one does not).
    await this.deadlineWriter.sync(tx, kind, recordId);
    return { outcome: 'APPLIED', recordFlowId: recordFlow.id, flowId: flow.id, versionId: version.id, match, confirmed: !unknown, steps: plan.length };
  }

  /** A person chose a flow: it must exist, be in use and be of the record's kind. */
  private chosenFlow(config: ResolveConfig, kind: RecordKind, flowId: string): FlowResolution {
    const flow = config.flows.find((candidate) => candidate.id === flowId && candidate.recordKind === kind);
    if (!flow) throw new BadRequestException({ code: PROCESSING_ERROR.FLOW_NOT_FOUND });
    return { match: 'DEFAULT', flowId: flow.id };
  }

  private async calendarFor(tx: Tx, anchors: RecordAnchors) {
    const years = Object.values(anchors).map((anchor) => civilYearOf(civilDayOf(anchor.at)));
    if (years.length === 0) return buildWorkingCalendar([]);
    return this.calendars.load(Math.min(...years), Math.min(Math.max(...years) + CALENDAR_YEARS_AHEAD, MAX_CALENDAR_YEAR), tx);
  }

  /** The flow of a record, with its steps, as the tab shows it. `null`: no flow was applied to it. */
  async flowOf(kind: RecordKind, recordId: string, tx: Tx | PrismaService = this.prisma) {
    const row = await tx.procRecordFlow.findUnique({
      where: { recordKind_recordId: { recordKind: kind, recordId } },
      include: {
        flow: { select: { id: true, name: true } },
        version: { select: { id: true, versionNo: true } },
        steps: { orderBy: { order: 'asc' }, include: { parties: { orderBy: { order: 'asc' }, include: { team: { select: { name: true } } } }, step: { select: { name: true, anchor: true, setsRecordDeadline: true, requiresApproval: true, legalBasis: true } } } },
      },
    });
    if (!row) throw new NotFoundException({ code: PROCESSING_ERROR.RECORD_FLOW_NOT_FOUND });
    return row;
  }
}

/** The binding the match was made on (for the record of why): the entry's, or the deadline group's. */
function bindingOf(config: ResolveConfig, resolution: FlowResolution): { id: string } | undefined {
  const mine = config.bindings.filter((binding) => binding.flowId === resolution.flowId);
  if (resolution.match === 'TYPE') return mine.find((binding) => binding.directoryId === resolution.directoryId);
  if (resolution.match === 'GROUP') {
    const group = resolution.typeKey ? config.directoryIndex.get(resolution.typeKey)?.deadlineGroup : undefined;
    return mine.find((binding) => binding.deadlineGroup !== null && binding.deadlineGroup === group);
  }
  return undefined;
}

