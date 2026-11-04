-- The step a running reading job is on, so the screen can say what it waits for. Nullable: no backfill needed.
ALTER TABLE "ocr_jobs" ADD COLUMN "stage" TEXT;
