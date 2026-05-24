-- AddIndex
-- Composite index for journey timeline queries: fetch audit logs by entity (subjectId) sorted by time (createdAt)
CREATE INDEX "audit_logs_subjectId_createdAt_idx" ON "audit_logs"("subjectId", "createdAt");
