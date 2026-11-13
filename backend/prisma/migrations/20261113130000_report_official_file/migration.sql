-- The file a closed period is kept as (summary sheet + one sheet per team). New table only.

CREATE TYPE "DynReportOfficialFileStatus" AS ENUM ('READY', 'FAILED', 'SUPERSEDED', 'VOID');

CREATE TABLE "dyn_report_official_files" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "DynReportOfficialFileStatus" NOT NULL,
    "fileBytes" BYTEA,
    "fileName" TEXT,
    "error" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "dyn_report_official_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dyn_report_official_files_periodId_createdAt_idx" ON "dyn_report_official_files"("periodId", "createdAt");

ALTER TABLE "dyn_report_official_files" ADD CONSTRAINT "dyn_report_official_files_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "dyn_report_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
