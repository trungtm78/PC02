-- Rollback for P1-002 partial unique index migration.
-- Apply manually if revert needed (Prisma has no down-migrations).
DROP INDEX IF EXISTS "petitions_linkedCaseId_unique";
