-- Document Number Engine v0.42 — idempotent re-apply
-- Context: migration 20260525000001 was rolled back on production due to duplicate
-- caseCode values in metadata. This migration re-creates all v0.42 schema changes safely.
--
-- On fresh DBs (CI): migration 00001 already ran, so all IF NOT EXISTS clauses are no-ops.
-- On production:     migration 00001 was rolled back, so this applies everything fresh.

-- Case.caseCode column
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "caseCode" TEXT;

-- Backfill caseCode from metadata JSON — only where the value is unique across all cases.
-- Rows with duplicate metadata caseCode values remain NULL (assign via Document Number Engine).
-- WHERE caseCode IS NULL ensures this is idempotent (skips already-backfilled rows).
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

-- Unique index (IF NOT EXISTS = no-op if already created by migration 00001)
CREATE UNIQUE INDEX IF NOT EXISTS "cases_caseCode_key" ON "cases"("caseCode");

-- Document number tables (IF NOT EXISTS = no-op on CI/fresh DBs)
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

-- Foreign keys (idempotent via DO $$ existence checks)
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
