import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { RecordKind } from '../gateway/record-snapshot';
import { DEADLINE_RESYNC_BATCH, DEADLINE_RESYNC_DONE, DEADLINE_RESYNC_REASON, LEGAL_VERIFIED_REASON, resyncCursor } from './deadline-resync';
import { FlowApplicationService, type ApplyReason } from './flow-application.service';
import { RECORDS_SWITCH } from './record-deadline-writer.service';

type Tx = Prisma.TransactionClient;

/** The switch that lets a record get its flow by itself (defined beside the writer of the deadline, which reads it too). */
export { RECORDS_SWITCH };

/** How often the worker looks for work, and the pause before a failed attempt is tried again (doubling, capped). */
export const OUTBOX_TICK_MS = 10_000;
const FIRST_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
/** A claimed row that never finished (the process died) is picked up again after this long. */
const LEASE_MS = 5 * 60 * 1000;
export const MAX_ATTEMPTS = 8;
/** A record saved a moment ago gets its flow within about this long, without waiting for the next tick. */
const NUDGE_MS = 1500;
const MAX_ERROR_LENGTH = 500;

export interface DrainResult {
  done: number;
  retried: number;
  dead: number;
}

/**
 * Applying a flow to a record, after the record is saved.
 *
 * The record's own transaction writes ONE row here (`enqueue`) and nothing else, so the flow can never make a record
 * impossible to save; a worker applies the flow a moment later, and tries again until it works. While the switch
 * `processing_flow_records` is OFF nothing is written and nothing runs: records are saved exactly as before.
 *
 * A row is claimed with a lease (`FOR UPDATE SKIP LOCKED`, then pushed forward in time), so two workers never take the
 * same one and a process that dies mid-way only delays it: applying a flow is idempotent.
 */
@Injectable()
export class ProcessingOutboxService implements OnModuleInit {
  private readonly logger = new Logger(ProcessingOutboxService.name);
  private nudge: NodeJS.Timeout | null = null;
  /** Switched off by the specs, which drain by hand and must not have a timer do it in between. */
  nudgeEnabled = true;
  /**
   * The switch as it was last read. `enqueue` runs INSIDE the transaction of a record being saved and must not wait
   * for anything else (a refresh of the flag cache takes another connection, and a pool full of saves waiting for it
   * would stall them all): it reads this, and the worker's tick keeps it current. A switch turned ON reaches the saves
   * within one tick; records saved in between are left to the CLI that applies flows to open records.
   */
  private recordsOn = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
    private readonly applier: FlowApplicationService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshSwitch().catch((error: unknown) => this.logger.warn(`Reading the switch failed: ${String(error)}`));
  }

  /** Reads the switch (outside any transaction) and remembers it for `enqueue`. */
  async refreshSwitch(): Promise<boolean> {
    this.recordsOn = await this.flags.isEnabled(RECORDS_SWITCH);
    return this.recordsOn;
  }

  /**
   * Called inside the transaction that saves (or converts) a record. Writes nothing while the switch is off; when a
   * request for the same record is already waiting there is nothing to add.
   */
  async enqueue(tx: Tx, kind: RecordKind, recordId: string, reason: ApplyReason): Promise<void> {
    if (!this.recordsOn) return;
    const waiting = await tx.procOutbox.findFirst({ where: { recordKind: kind, recordId, status: 'PENDING' }, select: { id: true } });
    if (!waiting) await tx.procOutbox.create({ data: { recordKind: kind, recordId, reason } });
    this.scheduleNudge();
  }

  /** A short timer after a record was saved: the tab shows its steps within seconds instead of waiting for the tick. */
  private scheduleNudge(): void {
    if (!this.nudgeEnabled || this.nudge) return;
    this.nudge = setTimeout(() => {
      this.nudge = null;
      void this.drain().catch((error: unknown) => this.logger.warn(`Nudged drain failed: ${String(error)}`));
    }, NUDGE_MS);
    this.nudge.unref();
  }

  @Interval(OUTBOX_TICK_MS)
  async tick(): Promise<void> {
    try {
      if (!(await this.refreshSwitch())) return;
      await this.drain();
    } catch (error) {
      this.logger.warn(`Draining the outbox failed: ${String(error)}`);
    }
  }

  /** Takes up to `max` waiting rows, one at a time, and applies each. */
  async drain(max = 25): Promise<DrainResult> {
    const result: DrainResult = { done: 0, retried: 0, dead: 0 };
    for (let n = 0; n < max; n++) {
      // Checked before EVERY claim: a switch turned off while a batch runs (or before a nudge fires) stops the work.
      if (!(await this.flags.isEnabled(RECORDS_SWITCH))) break;
      const row = await this.claim();
      if (!row) break;
      try {
        if (row.reason === DEADLINE_RESYNC_REASON) {
          if (await this.resyncBatch(row)) result.done += 1;
          continue;
        }
        const outcome = await this.applier.apply({ kind: row.recordKind, recordId: row.recordId, reason: asReason(row.reason), actorId: null });
        await this.prisma.procOutbox.update({ where: { id: row.id }, data: { status: 'DONE', processedAt: new Date(), outcome: outcome.outcome, lastError: null } });
        result.done += 1;
      } catch (error) {
        const failed = await this.fail(row.id, row.attempts, error);
        if (failed === 'DEAD') result.dead += 1;
        else result.retried += 1;
      }
    }
    return result;
  }

  /**
   * One pass of the job "bring the records of a flow version in line with its verified deadline step" (the row holds
   * the VERSION in `recordId`): the next `DEADLINE_RESYNC_BATCH` records after where the job stopped, each in a
   * transaction of its own under the record's flow lock (`FlowApplicationService.resyncDeadline`), never all of them
   * in one. Returns whether the job is finished; when it is not, the row stays PENDING, due at once, with where it
   * stopped in `outcome`, and the attempts start again (a pass that worked is not a failed attempt).
   *
   * Idempotent and resumable: a record already in line is left as it is, so a pass done twice (the process died before
   * the mark) writes nothing twice. The switch is asked before every record: turned off mid-way, the job stops where
   * it is and waits. A record that fails throws: the row is retried later from the same place, like any other row.
   */
  private async resyncBatch(row: { id: string; recordKind: RecordKind; recordId: string; outcome: string | null }): Promise<boolean> {
    const after = resyncCursor.read(row.outcome);
    const flows = await this.prisma.procRecordFlow.findMany({
      where: { versionId: row.recordId, recordKind: row.recordKind, ...(after ? { id: { gt: after } } : {}) },
      select: { id: true, recordId: true },
      orderBy: { id: 'asc' },
      take: DEADLINE_RESYNC_BATCH,
    });
    let last: string | null = null;
    let stopped = false;
    for (const flow of flows) {
      if (!(await this.flags.isEnabled(RECORDS_SWITCH))) {
        stopped = true;
        break;
      }
      try {
        await this.applier.resyncDeadline(row.recordKind, flow.recordId, LEGAL_VERIFIED_REASON);
      } catch (error) {
        // What was done so far is kept, so the retry starts at the record that failed.
        if (last) await this.prisma.procOutbox.update({ where: { id: row.id }, data: { outcome: resyncCursor.write(last) } });
        throw error;
      }
      last = flow.id;
    }
    if (!stopped && flows.length < DEADLINE_RESYNC_BATCH) {
      await this.prisma.procOutbox.update({ where: { id: row.id }, data: { status: 'DONE', processedAt: new Date(), outcome: DEADLINE_RESYNC_DONE, lastError: null } });
      return true;
    }
    await this.prisma.procOutbox.update({
      where: { id: row.id },
      data: { availableAt: new Date(), attempts: 0, lastError: null, ...(last ? { outcome: resyncCursor.write(last) } : {}) },
    });
    return false;
  }

  /**
   * One waiting row, leased: nobody else takes it until the lease runs out. "Now" is the application's clock handed in
   * as a parameter, never the database's `NOW()`: the column is a timestamp without a time zone that Prisma writes in
   * UTC, and comparing it with a time-zone-aware `NOW()` shifts it by the session's offset.
   */
  private claim(): Promise<{ id: string; recordKind: RecordKind; recordId: string; reason: string; attempts: number; outcome: string | null } | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "proc_outbox"
        WHERE status = 'PENDING' AND "availableAt" <= ${new Date()}
        ORDER BY "availableAt", id
        LIMIT 1
        FOR UPDATE SKIP LOCKED`;
      if (rows.length === 0) return null;
      return tx.procOutbox.update({
        where: { id: rows[0].id },
        data: { attempts: { increment: 1 }, availableAt: new Date(Date.now() + LEASE_MS) },
        select: { id: true, recordKind: true, recordId: true, reason: true, attempts: true, outcome: true },
      });
    });
  }

  private async fail(id: string, attempts: number, error: unknown): Promise<'RETRY' | 'DEAD'> {
    const lastError = (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH);
    const dead = attempts >= MAX_ATTEMPTS;
    const wait = Math.min(FIRST_BACKOFF_MS * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);
    await this.prisma.procOutbox.update({
      where: { id },
      data: dead ? { status: 'DEAD', lastError, processedAt: new Date() } : { availableAt: new Date(Date.now() + wait), lastError },
    });
    if (dead) this.logger.error(`Applying a flow gave up after ${attempts} attempts: ${lastError}`);
    return dead ? 'DEAD' : 'RETRY';
  }
}

function asReason(value: string): ApplyReason {
  return value === 'CONVERTED' || value === 'REAPPLY' || value === 'CLI' ? value : 'CREATED';
}
