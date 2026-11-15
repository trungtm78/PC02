import type { Prisma } from '@prisma/client';
import type { RecordKind } from '../gateway/record-snapshot';

/**
 * The job "bring the deadline column of the records that follow this flow VERSION in line with the flow".
 *
 * Whether a flow keeps the deadline of a record depends on the legal verification of the step that sets it
 * (`RecordDeadlineWriter.managedDeadline`). A person verifying that step of a PUBLISHED version changes that answer for
 * every record already following the version, and those records are not written inside the verification's own
 * transaction (there may be thousands): the verification writes ONE row of the outbox, and the outbox worker does the
 * records afterwards, a bounded number per pass, each in a transaction of its own under the record's flow lock.
 *
 * The row reuses the columns of the outbox: `recordKind` is the kind of the flow, `recordId` holds the id of the
 * VERSION, `reason` is the kind of job, and while the job is under way `outcome` holds where it stopped.
 *
 * Nothing else reads these rows as "a flow to apply": `ProcessingOutboxService.enqueue` looks only at rows of the
 * applying kinds when it asks whether a record already waits, and the table has no unique key on kind, id or reason.
 */
export const DEADLINE_RESYNC_REASON = 'RESYNC_DEADLINE';

/**
 * The same work for ONE record the job of a version could not do when it met it: the record failed (retried apart, a
 * bounded number of times, given up on by itself), or it was SUSPENDED (it waits, uncounted, and is written after it
 * resumes). Here `recordId` IS the record. One such row waits per record at most.
 */
export const DEADLINE_RESYNC_RECORD_REASON = 'RESYNC_DEADLINE_RECORD';

/** The reasons of the rows that are NOT "apply a flow to this record". */
export const DEADLINE_RESYNC_REASONS: readonly string[] = [DEADLINE_RESYNC_REASON, DEADLINE_RESYNC_RECORD_REASON];

/**
 * After this many records the worker writes where it is and renews its claim of the job; a worker that finds the job
 * is no longer its own stops there.
 */
export const DEADLINE_RESYNC_CHECKPOINT = 10;

/** One pass stops after this long whatever is left, well inside the lease of a claim (5 minutes). */
export const DEADLINE_RESYNC_BUDGET_MS = 60_000;

/** What `outcome` says while a record of the second kind waits for its record to resume. */
export const DEADLINE_RESYNC_SUSPENDED = 'SUSPENDED';

/** A record that is suspended is asked about again after this long at first, then less and less often. */
export const DEADLINE_RESYNC_SUSPENDED_RECHECK_MS = 60_000;

/** A record that failed is tried again after this long at first. */
export const DEADLINE_RESYNC_FAILED_RETRY_MS = 15_000;

/**
 * Hands ONE record to a row of its own (`DEADLINE_RESYNC_RECORD_REASON`), unless one already waits for it.
 *
 * THE one way such a row is made. The caller's transaction must hold the flow lock of the record
 * (`pg_advisory_xact_lock(RECORD_FLOW_LOCK, hashtext(kind:recordId))`): the look and the insert are then one step, so
 * two workers, or a worker and a command, never both insert. The partial unique index of the migration
 * `20261125100000_proc_outbox_resync_unique` is the backstop for a caller that forgot the lock, and the insert
 * tolerates its refusal (`ON CONFLICT DO NOTHING`) instead of failing the caller's transaction.
 */
export async function deferRecordResync(tx: Prisma.TransactionClient, kind: RecordKind, recordId: string, why: { suspended: true } | { error: string }): Promise<void> {
  const base = { recordKind: kind, recordId, reason: DEADLINE_RESYNC_RECORD_REASON };
  const waiting = await tx.procOutbox.findFirst({ where: { ...base, status: 'PENDING' }, select: { id: true } });
  if (waiting) return;
  const now = Date.now();
  await tx.procOutbox.createMany({
    data: ['suspended' in why ? { ...base, availableAt: new Date(now + DEADLINE_RESYNC_SUSPENDED_RECHECK_MS), outcome: DEADLINE_RESYNC_SUSPENDED } : { ...base, availableAt: new Date(now + DEADLINE_RESYNC_FAILED_RETRY_MS), lastError: why.error }],
    skipDuplicates: true,
  });
}

/** How many records one pass of the worker does before it gives the job back (and remembers where it stopped). */
export const DEADLINE_RESYNC_BATCH = 100;

/** The reason written in the history row of a deadline this job wrote. */
export const LEGAL_VERIFIED_REASON = 'legal figures verified';

/** What `outcome` says when the job has done every record of the version. */
export const DEADLINE_RESYNC_DONE = 'RESYNCED';

const CURSOR = /^AFTER:([^;]*)(?:;DEFERRED:(\d+))?$/;

/**
 * Where an unfinished job stopped, kept in `outcome`: the id of the last flow of a record it went past, and how many
 * records it handed to rows of their own so far.
 */
export const resyncCursor = {
  write: (recordFlowId: string, deferred: number): string => `AFTER:${recordFlowId};DEFERRED:${deferred}`,
  read: (outcome: string | null): { after: string | null; deferred: number } => {
    const found = outcome ? CURSOR.exec(outcome) : null;
    return found ? { after: found[1], deferred: Number(found[2] ?? 0) } : { after: null, deferred: 0 };
  },
};

/**
 * Called inside the transaction that verifies the step. Written whatever the switch `processing_flow_records` says
 * (records may have got their flow while it was on); the worker does nothing while it is off, so the job waits.
 *
 * Always a row of its own, never merged with one that is waiting: a job half-way through a version must not swallow a
 * verification made after it started.
 */
export async function enqueueDeadlineResync(tx: Prisma.TransactionClient, kind: RecordKind, versionId: string): Promise<void> {
  await tx.procOutbox.create({ data: { recordKind: kind, recordId: versionId, reason: DEADLINE_RESYNC_REASON } });
}
