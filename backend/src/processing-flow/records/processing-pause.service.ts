import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TRANG_THAI_TAM_DINH_CHI } from '../../common/trang-thai/trang-thai-ket-thuc';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import { bandInstants } from '../engine/bands';
import { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';
import { RECORD_FLOW_LOCK } from './flow-application.service';
import { alertDriftCandidates, refreshRecordAlert } from './record-alert';
import { RecordDeadlineWriter } from './record-deadline-writer.service';
import { RECORDS_SWITCH } from './processing-outbox.service';

export const PAUSE_TICK_MS = 60_000;
const CHUNK = 500;
/** How many stored alerts one look puts right: a bulk change of thousands of records is worked off over several ticks. */
export const ALERT_RECONCILE_BATCH = 500;

export interface ReconcileResult {
  opened: number;
  closed: number;
}

/**
 * The clock of a record stands still while the record is suspended AND has a step being worked.
 *
 * Nothing in the three record services says "suspended" to the flow, and none has to: this worker compares what the
 * records say with what the flow knows. For each record it looks at, ONE decision is made under the record's lock, from
 * what the record and its steps say at that moment (never from what a list said a moment earlier):
 *
 *   the clock should stand still = the record is suspended (not finished, not deleted) and some step is OPEN or REPORTED
 *
 *   it should, and no pause is open  -> a pause opens
 *   it should not, and a pause is open -> the pause closes; when the record is still alive, the deadlines of the steps
 *                                         that were being worked move later by the time spent paused (the regulatory
 *                                         and the internal one alike; the bands are recomputed)
 *
 * So a record whose last step was completed while suspended stops its pause, and a step reopened during the suspension
 * starts a new one. Idempotent, and safe to run twice at once. While the switch is OFF it does nothing.
 */
@Injectable()
export class ProcessingPauseService {
  private readonly logger = new Logger(ProcessingPauseService.name);
  /** The clock, replaceable by a spec. */
  now: () => Date = () => new Date();
  private reconcilingAlerts = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RecordGateway,
    private readonly flags: FeatureFlagsService,
    private readonly deadlineWriter: RecordDeadlineWriter,
  ) {}

  @Interval(PAUSE_TICK_MS)
  async tick(): Promise<void> {
    try {
      if (!(await this.flags.isEnabled(RECORDS_SWITCH))) return;
      await this.reconcile();
      await this.reconcileAlerts();
    } catch (error) {
      this.logger.warn(`Reconciling the pauses failed: ${String(error)}`);
    }
  }

  async reconcile(): Promise<ReconcileResult> {
    const result: ReconcileResult = { opened: 0, closed: 0 };
    for (const candidate of await this.candidates()) {
      const done = await this.settle(candidate.kind, candidate.recordId, candidate.flowId);
      if (done === 'OPENED') result.opened += 1;
      if (done === 'CLOSED') result.closed += 1;
    }
    return result;
  }

  /** The flows worth a look: those with an open pause, and those of records that are suspended right now. */
  private async candidates(): Promise<Array<{ kind: RecordKind; recordId: string; flowId: string }>> {
    const found = new Map<string, { kind: RecordKind; recordId: string; flowId: string }>();
    const open = await this.prisma.procRecordPause.findMany({ where: { to: null }, select: { recordFlow: { select: { id: true, recordKind: true, recordId: true } } } });
    for (const { recordFlow } of open) found.set(recordFlow.id, { kind: recordFlow.recordKind, recordId: recordFlow.recordId, flowId: recordFlow.id });

    for (const kind of ['PETITION', 'INCIDENT', 'CASE'] as const) {
      const ids = await this.suspendedIds(kind);
      for (let at = 0; at < ids.length; at += CHUNK) {
        const flows = await this.prisma.procRecordFlow.findMany({
          where: { recordKind: kind, recordId: { in: ids.slice(at, at + CHUNK) }, pauses: { none: { to: null } }, steps: { some: { status: { in: ['OPEN', 'REPORTED'] } } } },
          select: { id: true, recordId: true },
        });
        for (const flow of flows) found.set(flow.id, { kind, recordId: flow.recordId, flowId: flow.id });
      }
    }
    return [...found.values()];
  }

  /** Records that are suspended now, of one kind: their ids. */
  private async suspendedIds(kind: RecordKind): Promise<string[]> {
    const where = { deletedAt: null };
    if (kind === 'PETITION') return (await this.prisma.petition.findMany({ where: { ...where, status: { in: [...TRANG_THAI_TAM_DINH_CHI.petition] } }, select: { id: true } })).map((r) => r.id);
    if (kind === 'INCIDENT') return (await this.prisma.incident.findMany({ where: { ...where, status: { in: [...TRANG_THAI_TAM_DINH_CHI.incident] } }, select: { id: true } })).map((r) => r.id);
    return (await this.prisma.case.findMany({ where: { ...where, status: { in: [...TRANG_THAI_TAM_DINH_CHI.case] } }, select: { id: true } })).map((r) => r.id);
  }

  /** The one decision, made under the record's lock from what is true now. */
  private settle(kind: RecordKind, recordId: string, flowId: string): Promise<'OPENED' | 'CLOSED' | null> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RECORD_FLOW_LOCK}::int, hashtext(${`${kind}:${recordId}`})::int)`;
      const flow = await tx.procRecordFlow.findUnique({ where: { id: flowId }, select: { id: true } });
      if (!flow) return null;

      const snapshot = await this.gateway.load(kind, recordId, tx);
      const alive = snapshot !== null && !snapshot.isFinished;
      const working = await tx.procRecordStep.count({ where: { recordFlowId: flowId, status: { in: ['OPEN', 'REPORTED'] } } });
      const shouldStand = alive && snapshot.isSuspended && working > 0;
      const open = await tx.procRecordPause.findFirst({ where: { recordFlowId: flowId, to: null } });

      if (shouldStand && !open) {
        const from = this.now();
        await tx.procRecordPause.create({ data: { recordFlowId: flowId, from, reason: 'SUSPENDED' } });
        await tx.procStepChange.create({ data: { recordFlowId: flowId, recordKind: kind, recordId, action: 'CLOCK_PAUSED', toValue: { from: from.toISOString(), reason: 'SUSPENDED' }, actorId: null } });
        // A clock that stands still shows no colour: the stored alert goes.
        await refreshRecordAlert(tx, this.gateway, kind, recordId);
        return 'OPENED';
      }
      if (!shouldStand && open) {
        // A worker whose clock runs behind another's must not close a pause before it began.
        const now = this.now();
        const to = now.getTime() < open.from.getTime() ? open.from : now;
        await tx.procRecordPause.update({ where: { id: open.id }, data: { to } });

        let moved = 0;
        if (alive) moved = await this.shiftDeadlines(tx, flowId, open.from, to);
        // Also when no step moved (the write changes nothing when the column already agrees), but never while the
        // record is STILL suspended: a pause also closes when no step is being worked any more, and a suspended
        // record's deadline is written at its resumption (by the row the resync job keeps for it, `deadline-resync.ts`).
        if (alive && !snapshot.isSuspended) await this.deadlineWriter.sync(tx, kind, recordId);
        await tx.procStepChange.create({
          data: { recordFlowId: flowId, recordKind: kind, recordId, action: 'CLOCK_RESUMED', fromValue: { from: open.from.toISOString() }, toValue: { to: to.toISOString(), stepsMoved: moved, recordAlive: alive }, actorId: null },
        });
        // The clock runs again (or the record is done): the stored alert is that of the deadlines as they are now.
        await refreshRecordAlert(tx, this.gateway, kind, recordId);
        return 'CLOSED';
      }
      return null;
    });
  }

  /**
   * The stored alert of the records whose STATUS changed without a word to the flow (finished, worked again, deleted):
   * each is recomputed under the record's lock from what is true at that moment. Answers how many were rewritten.
   */
  async reconcileAlerts(limit = ALERT_RECONCILE_BATCH): Promise<number> {
    // One look at a time in this process: a look that outlasts the tick is not joined by the next one.
    if (this.reconcilingAlerts) return 0;
    this.reconcilingAlerts = true;
    try {
      let written = 0;
      for (const { kind, recordId } of await alertDriftCandidates(this.prisma, limit)) {
        const done = await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RECORD_FLOW_LOCK}::int, hashtext(${`${kind}:${recordId}`})::int)`;
          return refreshRecordAlert(tx, this.gateway, kind, recordId);
        });
        if (done === 'WRITTEN') written += 1;
      }
      return written;
    } finally {
      this.reconcilingAlerts = false;
    }
  }

  /** The steps being worked lose the time spent paused: both deadlines move later, the bands follow. */
  private async shiftDeadlines(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0], flowId: string, from: Date, to: Date): Promise<number> {
    const steps = await tx.procRecordStep.findMany({
      where: { recordFlowId: flowId, status: { in: ['OPEN', 'REPORTED'] }, regulatoryDueAt: { gt: from } },
      include: { step: true },
    });
    let moved = 0;
    for (const step of steps) {
      // A step that started while the clock was stopped lost only the part of the pause after it started.
      const since = step.startAt && step.startAt.getTime() > from.getTime() ? step.startAt : from;
      const length = Math.max(to.getTime() - since.getTime(), 0);
      if (length === 0) continue;
      const regulatory = new Date((step.regulatoryDueAt as Date).getTime() + length);
      const internal = step.internalDueAt ? new Date(step.internalDueAt.getTime() + length) : regulatory;
      const due = internal.getTime() < regulatory.getTime() ? internal : regulatory;
      await tx.procRecordStep.update({
        where: { id: step.id },
        data: { regulatoryDueAt: regulatory, internalDueAt: internal, ...bandInstants(due, step.step), deadlineRevision: { increment: 1 }, revision: { increment: 1 } },
      });
      moved += 1;
    }
    if (moved > 0) await tx.procRecordFlow.update({ where: { id: flowId }, data: { revision: { increment: 1 } } });
    return moved;
  }
}
