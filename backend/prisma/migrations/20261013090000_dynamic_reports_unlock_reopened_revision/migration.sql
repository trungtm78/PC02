-- A grant that reopens a handed-in submission remembers the revision it created, so revoking it can close exactly that window.
ALTER TABLE "dyn_report_unlocks" ADD COLUMN "reopenedRevision" BIGINT;
