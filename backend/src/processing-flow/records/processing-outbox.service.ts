import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { RecordKind } from '../gateway/record-snapshot';
import {
  DEADLINE_RESYNC_BATCH,
  DEADLINE_RESYNC_BUDGET_MS,
  DEADLINE_RESYNC_CHECKPOINT,
  DEADLINE_RESYNC_DONE,
  DEADLINE_RESYNC_REASON,
  DEADLINE_RESYNC_REASONS,
  DEADLINE_RESYNC_RECORD_REASON,
  DEADLINE_RESYNC_SUSPENDED,
  LEGAL_VERIFIED_REASON,
  resyncCursor,
} from './deadline-resync';
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
/** A record that is suspended is asked about again after this long at first, then less and less often (capped). */
const SUSPENDED_FIRST_RECHECK_MS = 60_000;

/**
 * A row as its worker claimed it. `availableAt` is the end of the lease the claim wrote, and it is the TOKEN of the
 * claim: every later write of the row by this worker asks for it (`owned`), so a worker whose lease ran out and whose
 * row was taken by another writes nothing over the other's work.
 */
interface ClaimedRow {
  id: string;
  recordKind: RecordKind;
  recordId: string;
  reason: string;
  attempts: number;
  outcome: string | null;
  createdAt: Date;
  availableAt: Date;
}

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
    // Only a waiting request to APPLY a flow makes this one superfluous: a row of the deadline resync for the same
    // record is other work.
    const waiting = await tx.procOutbox.findFirst({ where: { recordKind: kind, recordId, status: 'PENDING', reason: { notIn: [...DEADLINE_RESYNC_REASONS] } }, select: { id: true } });
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
        if (row.reason === DEADLINE_RESYNC_RECORD_REASON) {
          if (await this.resyncRecord(row)) result.done += 1;
          continue;
        }
        const outcome = await this.applier.apply({ kind: row.recordKind, recordId: row.recordId, reason: asReason(row.reason), actorId: null });
        await this.prisma.procOutbox.update({ where: { id: row.id }, data: { status: 'DONE', processedAt: new Date(), outcome: outcome.outcome, lastError: null } });
        result.done += 1;
      } catch (error) {
        const failed = await this.fail(row, error);
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
   *   - A record that cannot be done now never stops the scan: one that FAILS, and one that is SUSPENDED, get a row
   *     of their own (`defer`) and the job goes on; its last word says how many (`RESYNCED deferred=N`).
   *   - Every `DEADLINE_RESYNC_CHECKPOINT` records it writes where it is and renews its lease, and it stops by itself
   *     after `DEADLINE_RESYNC_BUDGET_MS`: a pass never outlives its claim. Each of those writes asks for the claim
   *     (`owned`); when another worker has taken the row, this one stops without writing anything.
   *   - Idempotent and resumable: a record already in line is left as it is, so a pass done twice writes nothing
   *     twice. The switch is asked before every record: turned off mid-way, the job stops where it is and waits.
   */
  private async resyncBatch(row: ClaimedRow): Promise<boolean> {
    const state = resyncCursor.read(row.outcome);
    const flows = await this.prisma.procRecordFlow.findMany({
      where: { versionId: row.recordId, recordKind: row.recordKind, ...(state.after ? { id: { gt: state.after } } : {}) },
      select: { id: true, recordId: true },
      orderBy: { id: 'asc' },
      take: DEADLINE_RESYNC_BATCH,
    });
    const started = Date.now();
    let { after, deferred } = state;
    let sinceCheckpoint = 0;
    let handedBack = false;
    for (const flow of flows) {
      if (Date.now() - started > DEADLINE_RESYNC_BUDGET_MS || !(await this.flags.isEnabled(RECORDS_SWITCH))) {
        handedBack = true;
        break;
      }
      let unresolved: { suspended: true } | { error: unknown } | null = null;
      try {
        if ((await this.applier.resyncDeadline(row.recordKind, flow.recordId, LEGAL_VERIFIED_REASON)) === 'SUSPENDED') unresolved = { suspended: true };
      } catch (error) {
        unresolved = { error };
      }
      if (unresolved) {
        await this.defer(row.recordKind, flow.recordId, unresolved);
        deferred += 1;
      }
      after = flow.id;
      sinceCheckpoint += 1;
      if (sinceCheckpoint >= DEADLINE_RESYNC_CHECKPOINT) {
        sinceCheckpoint = 0;
        // The claim was lost: another worker has the job, and whatever it wrote stays as it is.
        if (!(await this.owned(row, { availableAt: new Date(Date.now() + LEASE_MS), outcome: resyncCursor.write(after, deferred) }))) return false;
      }
    }
    if (!handedBack && flows.length < DEADLINE_RESYNC_BATCH) {
      const outcome = deferred > 0 ? `${DEADLINE_RESYNC_DONE} deferred=${deferred}` : DEADLINE_RESYNC_DONE;
      return this.owned(row, { status: 'DONE', processedAt: new Date(), outcome, lastError: null });
    }
    await this.owned(row, { availableAt: new Date(), attempts: 0, lastError: null, ...(after ? { outcome: resyncCursor.write(after, deferred) } : {}) });
    return false;
  }

  /**
   * The row of ONE record the job of a version went past (`recordId` is the record). A record still SUSPENDED waits
   * on: asked again later and later, and that is not a failed attempt. Anything else is the end of the row (written,
   * already in line, no longer kept by the flow, finished or gone). A failure throws: retried with the pauses of any
   * row, and given up on (DEAD) after `MAX_ATTEMPTS`, by itself.
   */
  private async resyncRecord(row: ClaimedRow): Promise<boolean> {
    const outcome = await this.applier.resyncDeadline(row.recordKind, row.recordId, LEGAL_VERIFIED_REASON);
    if (outcome === 'SUSPENDED') {
      const wait = Math.min(Math.max(Date.now() - row.createdAt.getTime(), SUSPENDED_FIRST_RECHECK_MS), MAX_BACKOFF_MS);
      await this.owned(row, { availableAt: new Date(Date.now() + wait), attempts: 0, outcome: DEADLINE_RESYNC_SUSPENDED, lastError: null });
      return false;
    }
    return this.owned(row, { status: 'DONE', processedAt: new Date(), outcome, lastError: null });
  }

  /** Hands one record to a row of its own, unless one already waits for it (a pass done twice hands it over once). */
  private async defer(kind: RecordKind, recordId: string, why: { suspended: true } | { error: unknown }): Promise<void> {
    const waiting = await this.prisma.procOutbox.findFirst({ where: { recordKind: kind, recordId, reason: DEADLINE_RESYNC_RECORD_REASON, status: 'PENDING' }, select: { id: true } });
    if (waiting) return;
    const base = { recordKind: kind, recordId, reason: DEADLINE_RESYNC_RECORD_REASON };
    await this.prisma.procOutbox.create({
      data:
        'suspended' in why
          ? { ...base, availableAt: new Date(Date.now() + SUSPENDED_FIRST_RECHECK_MS), outcome: DEADLINE_RESYNC_SUSPENDED }
          : { ...base, availableAt: new Date(Date.now() + FIRST_BACKOFF_MS), lastError: errorText(why.error) },
    });
  }

  /**
   * A write of a claimed row by the worker that claimed it: it matches nothing when the row is no longer PENDING under
   * THIS claim (the lease ran out and another worker took it), and says so. A new lease becomes the new token.
   */
  private async owned(row: ClaimedRow, data: Prisma.ProcOutboxUpdateManyMutationInput): Promise<boolean> {
    const { count } = await this.prisma.procOutbox.updateMany({ where: { id: row.id, status: 'PENDING', availableAt: row.availableAt }, data });
    if (count === 0) return false;
    if (data.availableAt instanceof Date) row.availableAt = data.availableAt;
    return true;
  }

  /**
   * One waiting row, leased: nobody else takes it until the lease runs out. "Now" is the application's clock handed in
   * as a parameter, never the database's `NOW()`: the column is a timestamp without a time zone that Prisma writes in
   * UTC, and comparing it with a time-zone-aware `NOW()` shifts it by the session's offset.
   */
  private claim(): Promise<ClaimedRow | null> {
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
        select: { id: true, recordKind: true, recordId: true, reason: true, attempts: true, outcome: true, createdAt: true, availableAt: true },
      });
    });
  }

  /** Under the worker's claim, like every write of a claimed row: a row another worker took is theirs to judge. */
  private async fail(row: ClaimedRow, error: unknown): Promise<'RETRY' | 'DEAD'> {
    const lastError = errorText(error);
    const dead = row.attempts >= MAX_ATTEMPTS;
    const wait = Math.min(FIRST_BACKOFF_MS * 2 ** Math.max(row.attempts - 1, 0), MAX_BACKOFF_MS);
    await this.owned(row, dead ? { status: 'DEAD', lastError, processedAt: new Date() } : { availableAt: new Date(Date.now() + wait), lastError });
    if (dead) this.logger.error(`Outbox row ${row.id} (${row.reason}) gave up after ${row.attempts} attempts: ${lastError}`);
    return dead ? 'DEAD' : 'RETRY';
  }
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH);
}

function asReason(value: string): ApplyReason {
  return value === 'CONVERTED' || value === 'REAPPLY' || value === 'CLI' ? value : 'CREATED';
}
