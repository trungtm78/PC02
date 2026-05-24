-- AddIndex
-- Composite index for journey timeline queries: fetch audit logs by entity (subjectId) sorted by time (createdAt)
CREATE INDEX "audit_logs_subjectId_createdAt_idx" ON "audit_logs"("subjectId", "createdAt" DESC);

-- DropIndex
-- Single-column subjectId index is fully covered by the composite above
DROP INDEX "audit_logs_subjectId_idx";
