-- CreateEnum
CREATE TYPE "OcrJobKind" AS ENUM ('READ', 'ANALYSE');

-- CreateEnum
CREATE TYPE "OcrJobState" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ocr_jobs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" "OcrJobKind" NOT NULL,
    "state" "OcrJobState" NOT NULL DEFAULT 'QUEUED',
    "inputFingerprint" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedBy" TEXT,
    "claimedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ocr_jobs_state_runAfter_idx" ON "ocr_jobs"("state", "runAfter");

-- CreateIndex
CREATE INDEX "ocr_jobs_sessionId_state_idx" ON "ocr_jobs"("sessionId", "state");

-- AddForeignKey
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ocr_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Rules Prisma cannot express. Idempotent: the PostgreSQL spec re-applies this section on a scratch database
-- built with `prisma db push`.

-- Asking twice for the same input state is one job while it is queued or running.
CREATE UNIQUE INDEX IF NOT EXISTS "ocr_jobs_one_active" ON "ocr_jobs" ("sessionId", "kind", "inputFingerprint")
  WHERE "state" IN ('QUEUED', 'RUNNING');
