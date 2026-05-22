-- v0.34.0.0: CREATE INDEX CONCURRENTLY for directories(type, officialCode)
-- IMPORTANT: This file MUST contain only CONCURRENTLY statements so Prisma runs
-- it outside a transaction (Prisma wraps multi-statement migrations in BEGIN/COMMIT
-- which conflicts with CONCURRENTLY). Reference: v0.33 deploy hot-fix precedent.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "directories_type_officialCode_idx"
  ON "directories"("type", "officialCode")
  WHERE "officialCode" IS NOT NULL;
