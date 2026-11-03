-- Finalising a bound session is claimed by one instance at a time, and a session that keeps failing waits longer
-- between tries instead of occupying the front of every sweep.
ALTER TABLE "ocr_sessions" ADD COLUMN IF NOT EXISTS "finaliseClaimedAt" TIMESTAMP(3);
ALTER TABLE "ocr_sessions" ADD COLUMN IF NOT EXISTS "finaliseNextAt" TIMESTAMP(3);
ALTER TABLE "ocr_sessions" ADD COLUMN IF NOT EXISTS "finaliseAttempts" INTEGER NOT NULL DEFAULT 0;
