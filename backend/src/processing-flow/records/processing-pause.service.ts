import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TRANG_THAI_TAM_DINH_CHI } from '../../common/trang-thai/trang-thai-ket-thuc';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import { bandInstants } from '../engine/bands';
import { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';
import { RECORD_FLOW_LOCK } from './flow-application.service';
import { RECORDS_SWITCH } from './processing-outbox.service';

export const PAUSE_TICK_MS = 60_000;
const CHUNK = 500;

export interface ReconcileResult {
  opened: number;
  closed: number;
}

/**
 * The clock of a record stands still while the record is suspended.
 *
 * Nothing in the three record services says "suspended" to the flow, and none has to: this worker compares what the
 * records say with what the flow knows. A suspended record whose flow has steps being worked gets an OPEN pause; a pause
 * whose record is no longer suspended (resumed, finished, deleted) is CLOSED, and when the record is still alive the
 * deadlines of the steps that were being worked move later by the time they spent paused (the regulatory and the
 * internal one alike; the bands are recomputed). The rule is `shiftForPauses`'s, one pause at a time.
 *
 * Idempotent, and safe to run twice at once: each change happens under the record's lock after the state is read again.
 * While the switch is OFF it does nothing.
 */
@Injectable()
export class ProcessingPauseService {
  private readonly logger = new Logger(ProcessingPauseService.name);
  /** The clock, replaceable by a spec. */
  now: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RecordGateway,
    private readonly flags: FeatureFlagsService,
  ) {}

  @Interval(PAUSE_TICK_MS)
  async tick(): Promise<void> {
    try {
      if (!(await this.flags.isEnabled(RECORDS_SWITCH))) return;
      await this.reconcile();
    } catch (error) {
      this.logger.warn(`Reconciling the pauses failed: ${String(error)}`);
    }
  }

  async reconcile(): Promise<ReconcileResult> {
    const closed = await this.closeEnded();
    const opened = await this.openNew();
    return { opened, closed };
  }

  /** Records that are suspended now, of one kind: their ids. */
  private async suspendedIds(kind: RecordKind): Promise<string[]> {
    const where = { deletedAt: null };
    if (kind === 'PETITION') return (await this.prisma.petition.findMany({ where: { ...where, status: { in: [...TRANG_THAI_TAM_DINH_CHI.petition] } }, select: { id: true } })).map((r) => r.id);
    if (kind === 'INCIDENT') return (await this.prisma.incident.findMany({ where: { ...where, status: { in: [...TRANG_THAI_TAM_DINH_CHI.incident] } }, select: { id: true } })).map((r) => r.id);
    return (await this.prisma.case.findMany({ where: { ...where, status: { in: [...TRANG_THAI_TAM_DINH_CHI.case] } }, select: { id: true } })).map((r) => r.id);
  }

  private async openNew(): Promise<number> {
    let opened = 0;
    for (const kind of ['PETITION', 'INCIDENT', 'CASE'] as const) {
      const ids = await this.suspendedIds(kind);
      for (let at = 0; at < ids.length; at += CHUNK) {
        const flows = await this.prisma.procRecordFlow.findMany({
          where: { recordKind: kind, recordId: { in: ids.slice(at, at + CHUNK) }, pauses: { none: { to: null } }, steps: { some: { status: { in: ['OPEN', 'REPORTED'] } } } },
          select: { id: true, recordId: true },
        });
        for (const flow of flows) {
          opened += await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RECORD_FLOW_LOCK}::int, hashtext(${`${kind}:${flow.recordId}`})::int)`;
            if ((await tx.procRecordPause.count({ where: { recordFlowId: flow.id, to: null } })) > 0) return 0;
            const from = this.now();
            await tx.procRecordPause.create({ data: { recordFlowId: flow.id, from, reason: 'SUSPENDED' } });
            await tx.procStepChange.create({ data: { recordFlowId: flow.id, recordKind: kind, recordId: flow.recordId, action: 'CLOCK_PAUSED', toValue: { from: from.toISOString(), reason: 'SUSPENDED' }, actorId: null } });
            return 1;
          });
        }
      }
    }
    return opened;
  }

  private async closeEnded(): Promise<number> {
    const open = await this.prisma.procRecordPause.findMany({ where: { to: null }, include: { recordFlow: { select: { id: true, recordKind: true, recordId: true } } } });
    let closed = 0;
    for (const pause of open) {
      const { recordKind: kind, recordId } = pause.recordFlow;
      const snapshot = await this.gateway.load(kind, recordId);
      const stillSuspended = snapshot !== null && snapshot.isSuspended && !snapshot.isFinished;
      if (stillSuspended) continue;
      const alive = snapshot !== null && !snapshot.isFinished;
      closed += await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RECORD_FLOW_LOCK}::int, hashtext(${`${kind}:${recordId}`})::int)`;
        const current = await tx.procRecordPause.findUnique({ where: { id: pause.id } });
        if (!current || current.to !== null) return 0;
        const to = this.now();
        await tx.procRecordPause.update({ where: { id: pause.id }, data: { to } });

        let moved = 0;
        if (alive) {
          const steps = await tx.procRecordStep.findMany({
            where: { recordFlowId: pause.recordFlow.id, status: { in: ['OPEN', 'REPORTED'] }, regulatoryDueAt: { gt: current.from } },
            include: { step: true },
          });
          for (const step of steps) {
            // A step that started while the clock was stopped lost only the part of the pause after it started.
            const since = step.startAt && step.startAt.getTime() > current.from.getTime() ? step.startAt : current.from;
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
          await tx.procRecordFlow.update({ where: { id: pause.recordFlow.id }, data: { revision: { increment: 1 } } });
        }
        await tx.procStepChange.create({
          data: { recordFlowId: pause.recordFlow.id, recordKind: kind, recordId, action: 'CLOCK_RESUMED', fromValue: { from: current.from.toISOString() }, toValue: { to: to.toISOString(), stepsMoved: moved, recordAlive: alive }, actorId: null },
        });
        return 1;
      });
    }
    return closed;
  }
}
