-- Files attached to the report of a processing step (C4): a document of the record, linked to the report.
-- One new nullable column; existing rows keep NULL. ON DELETE SET NULL: removing a report never removes a file.
ALTER TABLE "documents" ADD COLUMN "procStepReportId" TEXT;

CREATE INDEX "documents_procStepReportId_idx" ON "documents"("procStepReportId");

ALTER TABLE "documents" ADD CONSTRAINT "documents_procStepReportId_fkey" FOREIGN KEY ("procStepReportId") REFERENCES "proc_step_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
