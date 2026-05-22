-- v0.37.1 Deploy-1: CONCURRENTLY indexes for case provenance columns.
--
-- IMPORTANT: This file MUST contain only CONCURRENTLY statements so Prisma
-- runs it outside a transaction (Prisma wraps multi-statement migrations in
-- BEGIN/COMMIT which conflicts with CONCURRENTLY).
-- Pattern reference: 20260522092131_directories_official_code_index_concurrent.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "cases_caseProvenance_idx"
  ON "cases"("caseProvenance");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "cases_linkedPetitionId_idx"
  ON "cases"("linkedPetitionId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "cases_linkedIncidentId_idx"
  ON "cases"("linkedIncidentId");
