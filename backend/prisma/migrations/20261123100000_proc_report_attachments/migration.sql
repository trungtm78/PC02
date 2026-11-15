-- Files attached to the report of a processing step (C4): a document of the record, linked to the report.
-- One new nullable column; existing rows keep NULL. ON DELETE SET NULL: removing a report never removes a file.
ALTER TABLE "documents" ADD COLUMN "procStepReportId" TEXT;

CREATE INDEX "documents_procStepReportId_idx" ON "documents"("procStepReportId");

-- Added NOT VALID and validated apart: the new column is NULL in every existing row, and this way the table is not
-- scanned under the lock that blocks writers while the constraint is added.
ALTER TABLE "documents" ADD CONSTRAINT "documents_procStepReportId_fkey" FOREIGN KEY ("procStepReportId") REFERENCES "proc_step_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

ALTER TABLE "documents" VALIDATE CONSTRAINT "documents_procStepReportId_fkey";
