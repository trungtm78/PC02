-- One waiting row of the deadline resync per record.
--
-- The outbox keeps, for a record whose deadline could not be brought in line at once (it failed, or it is suspended),
-- one row with reason 'RESYNC_DEADLINE_RECORD' until the work is done. The code makes that row under the flow lock of
-- the record, so two writers never both insert; this index is the backstop should a writer ever forget the lock.
-- Partial, so finished rows (DONE, DEAD) and every other kind of row are untouched. The table is small: a plain
-- CREATE INDEX, not CONCURRENTLY (a migration runs inside a transaction).
CREATE UNIQUE INDEX "proc_outbox_resync_record_pending_key"
    ON "proc_outbox" ("recordKind", "recordId")
    WHERE "reason" = 'RESYNC_DEADLINE_RECORD' AND "status" = 'PENDING';
