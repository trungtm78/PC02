-- Document Number Engine (v0.42)
-- 1. Add Case.caseCode column + backfill from metadata JSON
-- 2. Create 3 new tables: document_number_templates, counters, logs

-- AlterTable: Case.caseCode (promoted from metadata)
ALTER TABLE "cases" ADD COLUMN "caseCode" TEXT;

-- Backfill caseCode from metadata JSON — only where value is unique across all cases.
-- Cases with duplicate metadata caseCode values remain NULL so the UNIQUE index succeeds.
-- Admins can assign new codes to those cases via the Document Number Engine.
UPDATE "cases" c
SET "caseCode" = TRIM(c."metadata"->>'caseCode')
WHERE c."metadata"->>'caseCode' IS NOT NULL
  AND TRIM(c."metadata"->>'caseCode') != ''
  AND 1 = (
    SELECT COUNT(*) FROM "cases" c2
    WHERE c2."metadata"->>'caseCode' IS NOT NULL
      AND TRIM(c2."metadata"->>'caseCode') = TRIM(c."metadata"->>'caseCode')
  );

-- Unique index AFTER backfill so duplicate data fails here, not mid-backfill
CREATE UNIQUE INDEX "cases_caseCode_key" ON "cases"("caseCode");

-- CreateTable: document_number_templates
CREATE TABLE "document_number_templates" (
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

CREATE INDEX "document_number_templates_documentType_idx" ON "document_number_templates"("documentType");
CREATE INDEX "document_number_templates_isActive_idx" ON "document_number_templates"("isActive");

-- CreateTable: document_number_counters
CREATE TABLE "document_number_counters" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_number_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_number_counters_templateId_periodKey_key" ON "document_number_counters"("templateId", "periodKey");
CREATE INDEX "document_number_counters_templateId_idx" ON "document_number_counters"("templateId");

-- CreateTable: document_number_logs
CREATE TABLE "document_number_logs" (
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

CREATE INDEX "document_number_logs_templateId_createdAt_idx" ON "document_number_logs"("templateId", "createdAt");
CREATE INDEX "document_number_logs_userId_idx" ON "document_number_logs"("userId");
CREATE INDEX "document_number_logs_documentId_idx" ON "document_number_logs"("documentId");

-- AddForeignKey
ALTER TABLE "document_number_templates"
    ADD CONSTRAINT "document_number_templates_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_number_counters"
    ADD CONSTRAINT "document_number_counters_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "document_number_templates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_number_logs"
    ADD CONSTRAINT "document_number_logs_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "document_number_templates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_number_logs"
    ADD CONSTRAINT "document_number_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
