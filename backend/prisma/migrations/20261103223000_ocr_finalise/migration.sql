-- A bound session is finalised after the record's transaction commits: its originals become documents of the record.
-- `finalisedAt` stays NULL until that is done, which is what the sweeper looks for.
ALTER TABLE "ocr_sessions" ADD COLUMN IF NOT EXISTS "finalisedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ocr_sessions_status_finalisedAt_idx" ON "ocr_sessions" ("status", "finalisedAt");
