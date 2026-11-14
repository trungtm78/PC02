-- Custom reports saved from the aggregate screen ("views" of a dynamic report): which criteria and which teams appear,
-- under what title. New table and one new enum value only; nothing existing is rewritten.

-- The new value is only added here, never used in this migration (a value added inside a transaction cannot be used
-- before that transaction commits).
ALTER TYPE "DynReportExportKind" ADD VALUE IF NOT EXISTS 'MANAGER_CUSTOM';

CREATE TABLE "dyn_report_views" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "showFilterLine" BOOLEAN NOT NULL DEFAULT true,
    "itemKeys" JSONB,
    "teamIds" JSONB,
    "teamColumns" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dyn_report_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dyn_report_views_reportId_archivedAt_idx" ON "dyn_report_views"("reportId", "archivedAt");

-- One name per report among the views that are not archived. The service enforces the same rule under a lock on the
-- report (the schema built by `prisma db push` has no partial index); this is the second line of defence.
CREATE UNIQUE INDEX "dyn_report_views_reportId_name_active_key" ON "dyn_report_views"("reportId", "name")
  WHERE "archivedAt" IS NULL;

ALTER TABLE "dyn_report_views" ADD CONSTRAINT "dyn_report_views_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "dyn_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
