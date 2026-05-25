-- Document Number Engine (v0.42) — fully idempotent migration
-- This migration may re-run after a partial failure, so every statement is safe to run twice.

-- Step 1: Add Case.caseCode column (IF NOT EXISTS = no-op if already added)
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "caseCode" TEXT;

-- Step 2: De-duplicate any caseCode values set by a previous partial run.
-- Keep only the row with the smallest id for each non-NULL caseCode value; set others to NULL.
-- This is a no-op on fresh DBs (no rows) and on DBs where this never ran before.
UPDATE "cases" c1
SET "caseCode" = NULL
WHERE c1."caseCode" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "cases" c2
    WHERE c2."caseCode" = c1."caseCode"
      AND c2.id < c1.id
  );

-- Step 3: Backfill caseCode from metadata JSON — only where value is unique.
-- WHERE caseCode IS NULL makes this idempotent: rows already set (by previous run or step above) are skipped.
UPDATE "cases" c
SET "caseCode" = TRIM(c."metadata"->>'caseCode')
WHERE c."caseCode" IS NULL
  AND c."metadata"->>'caseCode' IS NOT NULL
  AND TRIM(c."metadata"->>'caseCode') != ''
  AND 1 = (
    SELECT COUNT(*) FROM "cases" c2
    WHERE c2."metadata"->>'caseCode' IS NOT NULL
      AND TRIM(c2."metadata"->>'caseCode') = TRIM(c."metadata"->>'caseCode')
  );

-- Step 4: Unique index (IF NOT EXISTS = no-op if already created)
CREATE UNIQUE INDEX IF NOT EXISTS "cases_caseCode_key" ON "cases"("caseCode");

-- CreateTable: document_number_templates (IF NOT EXISTS = no-op on re-run)
CREATE TABLE IF NOT EXISTS "document_number_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "separator" TEXT NOT NULL DEFAULT '-',
    "inputMode" TEXT NOT NULL DEFAULT 'AUTO',
    "segments" JSONB NOT NULL,
    "counterConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "document_number_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "document_number_templates_documentType_idx" ON "document_number_templates"("documentType");
CREATE INDEX IF NOT EXISTS "document_number_templates_isActive_idx" ON "document_number_templates"("isActive");

-- CreateTable: document_number_counters
CREATE TABLE IF NOT EXISTS "document_number_counters" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_number_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_number_counters_templateId_periodKey_key" ON "document_number_counters"("templateId", "periodKey");
CREATE INDEX IF NOT EXISTS "document_number_counters_templateId_idx" ON "document_number_counters"("templateId");

-- CreateTable: document_number_logs
CREATE TABLE IF NOT EXISTS "document_number_logs" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "generatedNumber" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT,
    "userId" TEXT NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_number_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "document_number_logs_templateId_createdAt_idx" ON "document_number_logs"("templateId", "createdAt");
CREATE INDEX IF NOT EXISTS "document_number_logs_userId_idx" ON "document_number_logs"("userId");
CREATE INDEX IF NOT EXISTS "document_number_logs_documentId_idx" ON "document_number_logs"("documentId");

-- Foreign keys (DO $$ blocks = idempotent, no-op if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'document_number_templates_createdById_fkey'
      AND table_name = 'document_number_templates'
  ) THEN
    ALTER TABLE "document_number_templates"
        ADD CONSTRAINT "document_number_templates_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'document_number_counters_templateId_fkey'
      AND table_name = 'document_number_counters'
  ) THEN
    ALTER TABLE "document_number_counters"
        ADD CONSTRAINT "document_number_counters_templateId_fkey"
        FOREIGN KEY ("templateId") REFERENCES "document_number_templates"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'document_number_logs_templateId_fkey'
      AND table_name = 'document_number_logs'
  ) THEN
    ALTER TABLE "document_number_logs"
        ADD CONSTRAINT "document_number_logs_templateId_fkey"
        FOREIGN KEY ("templateId") REFERENCES "document_number_templates"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'document_number_logs_userId_fkey'
      AND table_name = 'document_number_logs'
  ) THEN
    ALTER TABLE "document_number_logs"
        ADD CONSTRAINT "document_number_logs_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
