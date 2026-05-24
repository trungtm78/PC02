-- disable automatic transactions
-- CONCURRENTLY requires running outside a transaction block (Prisma wraps migrations in BEGIN/COMMIT by default)
-- AddIndex
CREATE INDEX CONCURRENTLY "audit_logs_subjectId_createdAt_idx" ON "audit_logs"("subjectId", "createdAt" DESC);

-- DropIndex (single-column subjectId index is now fully covered by the composite above)
DROP INDEX CONCURRENTLY "audit_logs_subjectId_idx";
