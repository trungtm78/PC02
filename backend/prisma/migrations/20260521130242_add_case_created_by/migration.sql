-- v0.31.0.2: add Case.createdById for delete-with-reason creator check
-- Online migration pattern: NOT VALID + VALIDATE + CONCURRENTLY index
-- Legacy rows: createdById = NULL → falls back to ADMIN-only delete (see service)

-- Step 1: ADD COLUMN nullable (PG13+ metadata-only, instant)
ALTER TABLE "cases" ADD COLUMN "createdById" TEXT;

-- Step 2: FK NOT VALID (skips full table scan; brief ACCESS EXCLUSIVE)
ALTER TABLE "cases" ADD CONSTRAINT "cases_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- Step 3: Validate existing rows (SHARE UPDATE EXCLUSIVE — allows concurrent reads/writes)
ALTER TABLE "cases" VALIDATE CONSTRAINT "cases_createdById_fkey";

-- Step 4: Plain index (Prisma migrate deploy không support CONCURRENTLY trong same file
-- vì wraps trong transaction. CONCURRENTLY phải standalone migration.
-- Đây là plain CREATE INDEX — acceptable vì cases table chưa lớn (< 10k rows).
-- Nếu sau này table > 100k rows, migrate tách CONCURRENTLY ra migration riêng.)
CREATE INDEX "cases_createdById_idx" ON "cases"("createdById");
