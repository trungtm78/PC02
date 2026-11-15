import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { STEP_INCLUDE, toFlowStep } from '../config/flow-reader';
import { PROCESSING_ERROR, type ProcessingErrorCode } from '../contract/processing-codes';
import { civilDayFromIso, civilDayOf, civilYearOf } from '../engine/civil-day';
import { ProcessingEngineError } from '../engine/errors';
import { guardReopen, nextStep, type StepEvent } from '../engine/step-machine';
import type { StepStatus } from '../engine/types';
import { buildWorkingCalendar, MAX_CALENDAR_YEAR, type WorkingCalendar } from '../engine/working-calendar';
import { RecordGateway } from '../gateway/record-gateway';
import { RecordDeadlineWriter } from './record-deadline-writer.service';
import type { RecordKind } from '../gateway/record-snapshot';
import { FlowApplicationService, RECORD_FLOW_LOCK, anchorsOf, type ApplyOutcome } from './flow-application.service';
import { refreshRecordAlert } from './record-alert';
import { RECORD_FLOW_INCLUDE, loadFlowPeople, toRecordFlowDto, type FlowViewer, type RecordClock, type RecordFlowDto, type RecordFlowRow } from './record-flow.dto';
import { scheduleStep, type AnchorInstant, type RecordConditions } from './schedule-step';

type Tx = Prisma.TransactionClient;
type StepRow = RecordFlowRow['steps'][number];

/** What every write of the command layer carries. */
export interface CommandInput {
  /** The revision of the record's flow the person looked at. */
  expectedRevision: number;
  /** The client's key for this one write: a second arrival of the same key does nothing and answers the same. */
  idempotencyKey?: string;
}

const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;
const CALENDAR_YEARS_AHEAD = 3;
const MAX_REASON_LENGTH = 500;
const DEADLOCK_ATTEMPTS = 3;

function isDeadlock(error: unknown): boolean {
  const failure = error as { code?: string; meta?: { code?: string }; message?: string; response?: unknown };
  return failure.code === 'P2034' || (failure.code === 'P2010' && failure.meta?.code === '40P01') || /deadlock detected/i.test(failure.message ?? '');
}

const refuse = {
  bad: (code: ProcessingErrorCode) => new BadRequestException({ code }),
  conflict: (code: ProcessingErrorCode) => new ConflictException({ code }),
  notFound: (code: ProcessingErrorCode) => new NotFoundException({ code }),
};

/** A refusal of the pure layer, as the answer of a request. */
function asHttp(error: unknown): unknown {
  return error instanceof ProcessingEngineError ? refuse.conflict(error.code) : error;
}

/**
 * Every write to the steps of a record goes through here: it checks the revision the person looked at, asks the state
 * machine whether the step may do that, writes inside one transaction under the record's lock, appends what happened to
 * the history and the audit (metadata only), and answers the whole flow of the record as it is afterwards.
 *
 * A write that carries an idempotency key is done once: the key is stored with the answer in the same transaction, so a
 * retry after a lost answer (the app, a double click) gets that answer and changes nothing.
 *
 * WHO may do it is the caller's question (the route's permission and the record's own read policy); this class decides
 * only whether the record's flow and its steps allow it.
 */
@Injectable()
export class ProcessingCommandService {
  /** The clock, replaceable by a spec. */
  now: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RecordGateway,
    private readonly calendars: WorkingCalendarService,
    private readonly applier: FlowApplicationService,
    private readonly audit: AuditService,
    private readonly deadlineWriter: RecordDeadlineWriter,
  ) {}

  // ---- reading

  /** The flow of a record as the tab shows it; with `viewerId`, each step says what that person may do on it by their role. */
  async get(kind: RecordKind, recordId: string, viewerId?: string): Promise<RecordFlowDto> {
    const row = await this.prisma.procRecordFlow.findUnique({ where: { recordKind_recordId: { recordKind: kind, recordId } }, include: RECORD_FLOW_INCLUDE });
    if (!row) throw refuse.notFound(PROCESSING_ERROR.RECORD_FLOW_NOT_FOUND);
    return toRecordFlowDto(row, this.now(), await this.clockOf(this.prisma, kind, recordId), await loadFlowPeople(this.prisma, row, this.now(), await this.viewerOf(this.prisma, kind, recordId, viewerId)));
  }

  // ---- the flow of the record

  /** A person applies a flow to a record that has none (or names the flow to use). Answers what came of it. */
  async apply(actorId: string, kind: RecordKind, recordId: string, input: { flowId?: string; idempotencyKey?: string }): Promise<{ outcome: ApplyOutcome; flow: RecordFlowDto | null }> {
    return this.keyed(kind, recordId, actorId, 'APPLY', input.idempotencyKey, async (tx) => {
      const outcome = await this.applier.applyIn(tx, { kind, recordId, reason: 'REAPPLY', actorId, flowId: input.flowId });
      const flow = await this.read(tx, kind, recordId, actorId);
      return { outcome, flow };
    });
  }

  /** A person confirms the flow that was only proposed for a record whose information type nobody could recognise. */
  confirmFlow(actorId: string, kind: RecordKind, recordId: string, input: CommandInput): Promise<RecordFlowDto> {
    return this.write(kind, recordId, actorId, 'CONFIRM_FLOW', input, async (tx, flow) => {
      if (flow.confirmed) throw refuse.conflict(PROCESSING_ERROR.FLOW_ALREADY_CONFIRMED);
      const at = this.now();
      await tx.procRecordFlow.update({ where: { id: flow.id }, data: { confirmed: true, confirmedAt: at, confirmedById: actorId } });
      await this.change(tx, flow, null, 'FLOW_CONFIRMED', { confirmed: false }, { confirmed: true }, null, actorId);
    });
  }

  /**
   * Looks for the flow of a record again, while the one it has is only a PROPOSAL (its information type matched
   * nothing) and nothing has been done under it: the proposal is replaced by what the configuration says now (the
   * person fixed the information type, or names the flow). A record with a confirmed flow, or any step worked, keeps
   * it. If nothing fits, the proposal stays.
   */
  async reapplyFlow(actorId: string, kind: RecordKind, recordId: string, input: CommandInput & { flowId?: string }): Promise<{ outcome: ApplyOutcome; flow: RecordFlowDto | null }> {
    this.checkRevision(input.expectedRevision);
    return this.keyed(kind, recordId, actorId, 'REAPPLY_FLOW', input.idempotencyKey, async (tx) => {
      const flow = await tx.procRecordFlow.findUnique({ where: { recordKind_recordId: { recordKind: kind, recordId } }, include: { steps: { select: { status: true } }, _count: { select: { pauses: true } } } });
      if (!flow) throw refuse.notFound(PROCESSING_ERROR.RECORD_FLOW_NOT_FOUND);
      if (flow.revision !== input.expectedRevision) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      if (flow.confirmed) throw refuse.conflict(PROCESSING_ERROR.FLOW_ALREADY_CONFIRMED);
      // A clock that has been paused moved deadlines: a flow made from scratch would forget that, so the flow stays.
      // Reports and opinions (withdrawn ones too) are history that a flow made from scratch would orphan.
      const written = (await tx.procStepReport.count({ where: { recordKind: kind, recordId } })) + (await tx.procStepOpinion.count({ where: { recordKind: kind, recordId } }));
      if (written > 0 || flow.acceptedAt || flow._count.pauses > 0 || flow.steps.some((step) => step.status !== 'OPEN' && step.status !== 'WAITING_ANCHOR')) throw refuse.conflict(PROCESSING_ERROR.FLOW_HAS_PROGRESS);

      // The teams the old steps name are locked before their rows are touched, in the order a team merge takes them
      // (a merge locks a unit and then repoints its parties): a cycle between the two cannot form.
      const named = await tx.procRecordStepParty.findMany({ where: { recordStep: { recordFlowId: flow.id }, teamId: { not: null } }, select: { teamId: true } });
      const teamIds = [...new Set(named.map((party) => party.teamId as string))].sort();
      if (teamIds.length > 0) await tx.$queryRaw`SELECT id FROM "teams" WHERE id IN (${Prisma.join(teamIds)}) ORDER BY id FOR SHARE`;
      await tx.procRecordStepParty.deleteMany({ where: { recordStep: { recordFlowId: flow.id } } });
      await tx.procRecordStep.deleteMany({ where: { recordFlowId: flow.id } });
      await tx.procRecordFlow.delete({ where: { id: flow.id } });
      const outcome = await this.applier.applyIn(tx, { kind, recordId, reason: 'REAPPLY', actorId, flowId: input.flowId });
      // Nothing fits any more: the transaction is undone, the proposal stays.
      if (outcome.outcome !== 'APPLIED') throw refuse.conflict(PROCESSING_ERROR.NO_FLOW_FOR_RECORD);
      // The replacement carries on counting where the proposal stopped: a request that looked at the old revision is stale.
      await tx.procRecordFlow.update({ where: { id: outcome.recordFlowId }, data: { revision: flow.revision + 1 } });
      await tx.procStepChange.create({
        data: {
          recordFlowId: outcome.recordFlowId,
          recordKind: kind,
          recordId,
          action: 'FLOW_REPLACED',
          fromValue: { flowId: flow.flowId, versionId: flow.versionId, match: flow.match },
          toValue: { flowId: outcome.flowId, versionId: outcome.versionId, match: outcome.match },
          actorId,
        },
      });
      return { outcome, flow: await this.read(tx, kind, recordId, actorId) };
    });
  }

  /**
   * Records the day the record was accepted (thụ lý), which no record kind has a column for. The steps counted from it
   * stop waiting and get their deadlines. Said once: correcting it later moves deadlines, which a later step of this
   * epic does with an explicit reason.
   */
  async recordAccepted(actorId: string, kind: RecordKind, recordId: string, input: CommandInput & { date: string }): Promise<RecordFlowDto> {
    const day = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? civilDayFromIso(input.date) : Number.NaN;
    if (!Number.isFinite(day)) throw refuse.bad(PROCESSING_ERROR.ACCEPTED_DATE_INVALID);
    // The same shape every day anchor of a record has: the day at 00:00 UTC.
    const acceptedAt = new Date(`${input.date}T00:00:00.000Z`);
    if (Number.isNaN(acceptedAt.getTime())) throw refuse.bad(PROCESSING_ERROR.ACCEPTED_DATE_INVALID);

    return this.write(kind, recordId, actorId, 'RECORD_ACCEPTED', input, async (tx, flow) => {
      if (flow.acceptedAt) throw refuse.conflict(PROCESSING_ERROR.ACCEPTED_ALREADY_RECORDED);
      await tx.procRecordFlow.update({ where: { id: flow.id }, data: { acceptedAt } });
      await this.change(tx, flow, null, 'ACCEPTED_RECORDED', null, { acceptedAt: input.date }, null, actorId);

      const waiting = flow.steps.filter((step) => step.step.anchor === 'ACCEPTED' && step.status === 'WAITING_ANCHOR');
      const calendar = await this.calendarFor(tx, [acceptedAt]);
      for (const step of waiting) await this.open(tx, flow, step, { at: acceptedAt, hasTime: false }, calendar, actorId);
    });
  }

  // ---- one step

  /** A step that asks for no approval is done. */
  completeStep(actorId: string, kind: RecordKind, recordId: string, stepKey: string, input: CommandInput): Promise<RecordFlowDto> {
    return this.writeStep(kind, recordId, actorId, stepKey, 'COMPLETE', input, (tx, flow, step) => this.finishStep(tx, flow, step, 'COMPLETE', actorId));
  }

  /**
   * A step is finished: by `COMPLETE` (a step that asks for no approval) or by `APPROVE` (the leader agreed the result of
   * one that does). The step after it, counted from this completion, starts now.
   */
  async finishStep(tx: Tx, flow: RecordFlowRow, step: StepRow, event: 'COMPLETE' | 'APPROVE', actorId: string): Promise<void> {
    const at = this.now();
    const moved = this.transition(step, event);
    await tx.procRecordStep.update({ where: { id: step.id }, data: { status: moved.status, doneAt: at, doneById: actorId, revision: { increment: 1 } } });
    await this.change(tx, flow, step.stepKey, 'STEP_COMPLETED', { status: step.status }, { status: moved.status, via: event }, null, actorId);
    await this.startFollower(tx, flow, step, at, actorId);
  }

  /** A step moves between OPEN and REPORTED (a result is reported, withdrawn, returned); nothing else changes. */
  async moveStep(tx: Tx, flow: RecordFlowRow, step: StepRow, event: 'REPORT' | 'RETURN', reason: string | null, actorId: string): Promise<void> {
    const moved = this.transition(step, event);
    await tx.procRecordStep.update({ where: { id: step.id }, data: { status: moved.status, revision: { increment: 1 } } });
    await this.change(tx, flow, step.stepKey, event === 'REPORT' ? 'STEP_REPORTED' : 'STEP_RETURNED', { status: step.status }, { status: moved.status }, reason, actorId);
  }

  /** A finished step is worked again. The step after it, if already at work, keeps its deadline and is flagged. */
  reopenStep(actorId: string, kind: RecordKind, recordId: string, stepKey: string, input: CommandInput & { reason?: string }): Promise<RecordFlowDto> {
    return this.writeStep(kind, recordId, actorId, stepKey, 'REOPEN', input, async (tx, flow, step) => {
      const moved = this.transition(step, 'REOPEN');
      const follower = this.followerOf(flow, step);
      const { flagFollower } = this.guard(() => guardReopen(follower?.status ?? null));
      await tx.procRecordStep.update({ where: { id: step.id }, data: { status: moved.status, doneAt: null, doneById: null, revision: { increment: 1 } } });
      if (follower && flagFollower) await tx.procRecordStep.update({ where: { id: follower.id }, data: { upstreamReopened: true, revision: { increment: 1 } } });
      await this.change(tx, flow, step.stepKey, 'STEP_REOPENED', { status: step.status }, { status: moved.status }, cleanReason(input.reason), actorId);
    });
  }

  /** A step is set aside, with the reason. The step counted from it starts counting from this moment. */
  async skipStep(actorId: string, kind: RecordKind, recordId: string, stepKey: string, input: CommandInput & { reason: string }): Promise<RecordFlowDto> {
    const reason = cleanReason(input.reason);
    if (!reason) throw refuse.bad(PROCESSING_ERROR.STEP_REASON_REQUIRED);
    return this.writeStep(kind, recordId, actorId, stepKey, 'SKIP', input, async (tx, flow, step) => {
      const at = this.now();
      const moved = this.transition(step, 'SKIP');
      await tx.procRecordStep.update({ where: { id: step.id }, data: { status: moved.status, skippedFrom: moved.skippedFrom, skippedAt: at, revision: { increment: 1 } } });
      await this.change(tx, flow, step.stepKey, 'STEP_SKIPPED', { status: step.status }, { status: moved.status }, reason, actorId);
      await this.startFollower(tx, flow, step, at, actorId);
    });
  }

  /** A skipped step goes back to where it was; it opens when the date it is counted from exists by now. */
  unskipStep(actorId: string, kind: RecordKind, recordId: string, stepKey: string, input: CommandInput): Promise<RecordFlowDto> {
    return this.writeStep(kind, recordId, actorId, stepKey, 'UNSKIP', input, async (tx, flow, step) => {
      const follower = this.followerOf(flow, step);
      const { flagFollower } = this.guard(() => guardReopen(follower?.status ?? null));

      // It goes back to exactly where it was. A step that was waiting for its date opens below, only if it can be scheduled:
      // a date that exists but cannot be counted from (an hour-long duration on a day with no time) leaves it waiting.
      const moved = this.transition(step, 'UNSKIP');
      await tx.procRecordStep.update({ where: { id: step.id }, data: { status: moved.status, skippedFrom: null, skippedAt: null, revision: { increment: 1 } } });
      await this.change(tx, flow, step.stepKey, 'STEP_UNSKIPPED', { status: step.status }, { status: moved.status }, null, actorId);
      if (moved.status === 'WAITING_ANCHOR') {
        const anchor = await this.anchorOf(tx, flow, step);
        if (anchor) await this.open(tx, flow, { ...step, status: 'WAITING_ANCHOR' }, anchor, await this.calendarFor(tx, [anchor.at]), actorId);
      }
      if (follower && flagFollower) await tx.procRecordStep.update({ where: { id: follower.id }, data: { upstreamReopened: true, revision: { increment: 1 } } });
    });
  }

  // ---- how a write runs

  /** A write on the flow of a record: the lock, the key, the revision the person saw, the work, the answer. */
  async write(kind: RecordKind, recordId: string, actorId: string, command: string, input: CommandInput, job: (tx: Tx, flow: RecordFlowRow) => Promise<void>): Promise<RecordFlowDto> {
    this.checkRevision(input.expectedRevision);
    return this.keyed(kind, recordId, actorId, command, input.idempotencyKey, async (tx) => {
      const flow = await tx.procRecordFlow.findUnique({ where: { recordKind_recordId: { recordKind: kind, recordId } }, include: RECORD_FLOW_INCLUDE });
      if (!flow) throw refuse.notFound(PROCESSING_ERROR.RECORD_FLOW_NOT_FOUND);
      if (flow.revision !== input.expectedRevision) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      await job(tx, flow);
      await tx.procRecordFlow.update({ where: { id: flow.id }, data: { revision: { increment: 1 } } });
      // The record's own deadline column follows the step that keeps it, in the same transaction.
      await this.deadlineWriter.sync(tx, kind, recordId);
      // So does the stored alert of the record: whatever the command did to a step, it is recomputed from the steps.
      await refreshRecordAlert(tx, this.gateway, kind, recordId);
      await this.audit.log(
        {
          userId: actorId,
          action: `PROC_${command}`,
          subject: 'ProcRecordFlow',
          subjectId: flow.id,
          // Metadata only: what was done to which record. No deadline, no date, no text of the record.
          metadata: { recordKind: kind, recordId, command },
        },
        tx,
      );
      // The answer is the actor's: it says what THEY may do next on each step.
      return this.read(tx, kind, recordId, actorId);
    });
  }

  /** A write on one step: the same, with the step looked up by its key. */
  writeStep(
    kind: RecordKind,
    recordId: string,
    actorId: string,
    stepKey: string,
    command: string,
    input: CommandInput,
    job: (tx: Tx, flow: RecordFlowRow, step: StepRow) => Promise<void>,
  ): Promise<RecordFlowDto> {
    return this.write(kind, recordId, actorId, `STEP_${command}`, input, async (tx, flow) => {
      const step = flow.steps.find((candidate) => candidate.stepKey === stepKey);
      if (!step) throw refuse.notFound(PROCESSING_ERROR.RECORD_STEP_NOT_FOUND);
      await job(tx, flow, step);
    });
  }

  /** One transaction under the record's lock, with the idempotency key kept next to the answer. */
  private async keyed<T extends object>(kind: RecordKind, recordId: string, actorId: string, command: string, key: string | undefined, job: (tx: Tx) => Promise<T>): Promise<T> {
    if (key !== undefined && !KEY_PATTERN.test(key)) throw refuse.bad(PROCESSING_ERROR.IDEMPOTENCY_KEY_INVALID);
    // A transaction the database picked to break a lock cycle (with a team merge, say) wrote nothing: it is run again
    // from the start, a few times, and only then told to the caller as a conflict.
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.keyedOnce(kind, recordId, actorId, command, key, job);
      } catch (error) {
        if (!isDeadlock(error)) throw error;
        if (attempt >= DEADLOCK_ATTEMPTS) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      }
    }
  }

  private keyedOnce<T extends object>(kind: RecordKind, recordId: string, actorId: string, command: string, key: string | undefined, job: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma
      .$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RECORD_FLOW_LOCK}::int, hashtext(${`${kind}:${recordId}`})::int)`;
          if (key) {
            const seen = await tx.procCommandKey.findUnique({ where: { key } });
            if (seen) {
              if (seen.actorId !== actorId || seen.command !== command || seen.recordKind !== kind || seen.recordId !== recordId) throw refuse.conflict(PROCESSING_ERROR.IDEMPOTENCY_KEY_REUSED);
              return seen.outcome as unknown as T;
            }
          }
          const result = await job(tx);
          if (key) await tx.procCommandKey.create({ data: { key, actorId, command, recordKind: kind, recordId, outcome: result as unknown as Prisma.InputJsonValue } });
          return result;
        },
        { timeout: 60_000, maxWait: 10_000 },
      )
      .catch((error: unknown) => {
        throw asHttp(error);
      });
  }

  // ---- pieces

  private checkRevision(value: unknown): void {
    if (!Number.isInteger(value) || (value as number) < 1) throw refuse.bad(PROCESSING_ERROR.EXPECTED_REVISION_INVALID);
  }

  /** What the record says now: suspended (a record that is finished or gone is not), or finished. */
  private async clockOf(db: Tx | PrismaService, kind: RecordKind, recordId: string): Promise<RecordClock> {
    const snapshot = await this.gateway.load(kind, recordId, db);
    return { suspended: snapshot !== null && snapshot.isSuspended && !snapshot.isFinished, finished: snapshot !== null && snapshot.isFinished };
  }

  /**
   * The person an answer is for, with the ONE fact about the record the steps cannot tell: whether it is in the person's
   * OWN scope (the gateway's `canRead` without the step rule), which the decision route and assignment by permission
   * require. Asked once per record. The person is read as the request would carry them (role, dispatch right).
   */
  private async viewerOf(db: Tx | PrismaService, kind: RecordKind, recordId: string, viewerId: string | undefined): Promise<FlowViewer | undefined> {
    if (viewerId === undefined) return undefined;
    const person = await db.user.findUnique({ where: { id: viewerId }, select: { isActive: true, canDispatch: true, role: { select: { name: true } } } });
    if (!person?.isActive) return { id: viewerId, inOwnScope: false };
    const inOwnScope = await this.gateway.canRead(kind, recordId, { id: viewerId, role: person.role.name, canDispatch: person.canDispatch }, { viaStep: false });
    return { id: viewerId, inOwnScope };
  }

  async read(tx: Tx, kind: RecordKind, recordId: string, viewerId?: string): Promise<RecordFlowDto> {
    const row = await tx.procRecordFlow.findUnique({ where: { recordKind_recordId: { recordKind: kind, recordId } }, include: RECORD_FLOW_INCLUDE });
    return row ? toRecordFlowDto(row, this.now(), await this.clockOf(tx, kind, recordId), await loadFlowPeople(tx, row, this.now(), await this.viewerOf(tx, kind, recordId, viewerId))) : (null as unknown as RecordFlowDto);
  }

  transition(step: StepRow, event: StepEvent, context: { anchorAvailable?: boolean } = {}) {
    return this.guard(() =>
      nextStep({ status: step.status, requiresApproval: step.step.requiresApproval, skippedFrom: step.skippedFrom as 'WAITING_ANCHOR' | 'OPEN' | null }, event, context),
    );
  }

  private guard<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      throw asHttp(error);
    }
  }

  /** The step that is counted from the completion of `step`: the next one, when it says so. */
  private followerOf(flow: RecordFlowRow, step: StepRow): StepRow | null {
    const next = flow.steps.find((candidate) => candidate.order === step.order + 1);
    return next && next.step.anchor === 'PREVIOUS_STEP_DONE' ? next : null;
  }

  /** `step` is done or set aside at `at`: the step counted from it starts counting from there. */
  async startFollower(tx: Tx, flow: RecordFlowRow, step: StepRow, at: Date, actorId: string): Promise<void> {
    const follower = this.followerOf(flow, step);
    if (!follower) return;
    if (follower.status === 'WAITING_ANCHOR') {
      await this.open(tx, flow, follower, { at, hasTime: true }, await this.calendarFor(tx, [at]), actorId);
    } else if (follower.upstreamReopened) {
      // The step before is finished again: the note "the step before was reopened" has done its work.
      await tx.procRecordStep.update({ where: { id: follower.id }, data: { upstreamReopened: false, revision: { increment: 1 } } });
    }
  }

  /** A waiting step gets its date and its deadline and opens. A step the engine cannot schedule keeps waiting, saying why. */
  private async open(tx: Tx, flow: RecordFlowRow, step: StepRow, anchor: AnchorInstant, calendar: WorkingCalendar, actorId: string): Promise<void> {
    const config = await tx.procFlowStep.findUniqueOrThrow({ where: { id: step.stepId }, include: STEP_INCLUDE });
    const conditions = (flow.conditions ?? {}) as RecordConditions;
    const scheduled = scheduleStep(toFlowStep(config), anchor, conditions, calendar);
    if (!scheduled.ok) {
      await tx.procRecordStep.update({ where: { id: step.id }, data: { problem: scheduled.problem, revision: { increment: 1 } } });
      return;
    }
    const moved = this.transition(step, 'ANCHOR_REACHED');
    await tx.procRecordStep.update({
      where: { id: step.id },
      data: {
        status: moved.status,
        startAt: anchor.at,
        regulatoryDueAt: scheduled.dueAt,
        internalDueAt: scheduled.dueAt,
        provisional: scheduled.provisional,
        calendarVersion: scheduled.calendarVersion,
        greenFrom: scheduled.greenFrom,
        yellowFrom: scheduled.yellowFrom,
        redFrom: scheduled.redFrom,
        variant: scheduled.variant,
        problem: null,
        // The first deadline of a step is revision 1; a deadline that moves is a new revision (a reminder names it).
        deadlineRevision: step.regulatoryDueAt ? { increment: 1 } : undefined,
        revision: { increment: 1 },
      },
    });
    await this.change(tx, flow, step.stepKey, 'STEP_STARTED', { status: step.status }, { status: moved.status }, null, actorId);
  }

  /** The date a waiting step is counted from now, if it exists. */
  private async anchorOf(tx: Tx, flow: RecordFlowRow, step: StepRow): Promise<AnchorInstant | null> {
    const kind = step.step.anchor;
    if (kind === 'PREVIOUS_STEP_DONE') {
      const before = flow.steps.find((candidate) => candidate.order === step.order - 1);
      const at = before?.doneAt ?? before?.skippedAt ?? null;
      return at ? { at, hasTime: true } : null;
    }
    const snapshot = await this.gateway.load(flow.recordKind, flow.recordId, tx);
    if (!snapshot) return null;
    return anchorsOf(snapshot, flow.acceptedAt)[kind] ?? null;
  }

  async calendarFor(tx: Tx, instants: Date[]): Promise<WorkingCalendar> {
    const years = instants.map((at) => civilYearOf(civilDayOf(at)));
    if (years.length === 0) return buildWorkingCalendar([]);
    return this.calendars.load(Math.min(...years), Math.min(Math.max(...years) + CALENDAR_YEARS_AHEAD, MAX_CALENDAR_YEAR), tx);
  }

  /**
   * The person a write is made FOR, per transaction: a delegate who acts only because of a delegation. Every history row
   * the transaction writes afterwards for a person carries it (`onBehalfOfUserId`, in the row's `toValue`).
   */
  private readonly onBehalf = new WeakMap<object, string>();

  /** Marks the rest of this transaction as done by a delegate for `fromUserId`. */
  actOnBehalf(tx: Tx, fromUserId: string | null): void {
    if (fromUserId) this.onBehalf.set(tx, fromUserId);
  }

  change(tx: Tx, flow: RecordFlowRow, stepKey: string | null, action: string, from: unknown, to: unknown, reason: string | null, actorId: string | null) {
    const onBehalfOfUserId = actorId ? this.onBehalf.get(tx) : undefined;
    if (onBehalfOfUserId) to = typeof to === 'object' && to !== null && !Array.isArray(to) ? { ...to, onBehalfOfUserId } : to === null || to === undefined ? { onBehalfOfUserId } : { value: to, onBehalfOfUserId };
    return tx.procStepChange.create({
      data: {
        recordFlowId: flow.id,
        recordKind: flow.recordKind,
        recordId: flow.recordId,
        stepKey,
        action,
        fromValue: (from ?? undefined) as Prisma.InputJsonValue | undefined,
        toValue: (to ?? undefined) as Prisma.InputJsonValue | undefined,
        reason,
        actorId,
      },
    });
  }
}

/** A reason a person typed: trimmed, and kept to a length the history can hold; `null` when there is none. */
function cleanReason(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  return text === '' ? null : text.slice(0, MAX_REASON_LENGTH);
}
