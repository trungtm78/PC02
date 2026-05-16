-- Bulk Import Jobs (v0.25.0.0)
-- Durable audit trail thay BullMQ Redis-only state (autoplan Eng review E1).
-- Admin upload xlsx/csv → record source filename + SHA256 + row outcomes + file paths.

CREATE TABLE "bulk_import_jobs" (
    "id" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "rowOutcomes" JSONB,
    "originalFilePath" TEXT,
    "enrichedFilePath" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bulk_import_jobs_generatedBy_createdAt_idx" ON "bulk_import_jobs"("generatedBy", "createdAt");
CREATE INDEX "bulk_import_jobs_expiresAt_idx" ON "bulk_import_jobs"("expiresAt");

ALTER TABLE "bulk_import_jobs" ADD CONSTRAINT "bulk_import_jobs_generatedBy_fkey"
    FOREIGN KEY ("generatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
