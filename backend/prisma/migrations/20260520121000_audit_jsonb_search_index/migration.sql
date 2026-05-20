-- v0.29 audit_logs indices: GIN trigram for search + composite for forensic timeline.
-- Idempotent (IF NOT EXISTS).
--
-- Note: KHÔNG dùng CREATE INDEX CONCURRENTLY vì Prisma migrate runs in transaction
-- (CONCURRENTLY không support trong tx). Current DB ~1k rows, build < 1s. Future
-- nếu DB > 1M rows, DBA cần manual re-index. Document trong docs/DEPLOY.md.

-- pg_trgm extension cho ILIKE substring matching (idempotent extension creation)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on metadata::text cho free-text search via Prisma ILIKE.
-- Postgres docs: pg_trgm GIN ~50-100% size of source. ~2KB/row × 1M rows = 1-2GB.
-- At current ~1k rows, index < 1MB.
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_text
  ON audit_logs USING gin ((metadata::text) gin_trgm_ops);

-- Composite cho forensic query "show user X timeline at date Y" — covers
-- subject + subjectId + createdAt DESC scan pattern.
CREATE INDEX IF NOT EXISTS idx_audit_logs_subject_subjectid_created
  ON audit_logs (subject, "subjectId", "createdAt" DESC)
  WHERE subject IS NOT NULL AND "subjectId" IS NOT NULL;
