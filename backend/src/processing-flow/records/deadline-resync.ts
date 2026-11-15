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
 */
export const DEADLINE_RESYNC_REASON = 'RESYNC_DEADLINE';

/** How many records one pass of the worker does before it gives the job back (and remembers where it stopped). */
export const DEADLINE_RESYNC_BATCH = 100;

/** The reason written in the history row of a deadline this job wrote. */
export const LEGAL_VERIFIED_REASON = 'legal figures verified';

/** What `outcome` says when the job has done every record of the version. */
export const DEADLINE_RESYNC_DONE = 'RESYNCED';

const CURSOR_PREFIX = 'AFTER:';

/** Where an unfinished job stopped: the id of the last flow of a record it did, kept in `outcome`. */
export const resyncCursor = {
  write: (recordFlowId: string): string => `${CURSOR_PREFIX}${recordFlowId}`,
  read: (outcome: string | null): string | null => (outcome?.startsWith(CURSOR_PREFIX) ? outcome.slice(CURSOR_PREFIX.length) : null),
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
