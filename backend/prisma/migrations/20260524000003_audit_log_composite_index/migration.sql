-- AddIndex (CONCURRENTLY — runs outside transaction to avoid exclusive table lock)
-- Composite index for journey timeline queries: fetch audit logs by entity (subjectId) sorted by time (createdAt)
CREATE INDEX CONCURRENTLY "audit_logs_subjectId_createdAt_idx" ON "audit_logs"("subjectId", "createdAt" DESC);

-- DropIndex (CONCURRENTLY — the single-column subjectId index is now fully covered by the composite above)
DROP INDEX CONCURRENTLY "audit_logs_subjectId_idx";
