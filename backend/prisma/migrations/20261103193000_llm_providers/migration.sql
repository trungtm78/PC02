-- CreateEnum
CREATE TYPE "LlmProviderKind" AS ENUM ('ANTHROPIC', 'GEMINI', 'OPENAI_COMPATIBLE');

-- CreateEnum
CREATE TYPE "LlmProviderRole" AS ENUM ('PRIMARY', 'FALLBACK', 'OFF');

-- CreateTable
CREATE TABLE "llm_providers" (
    "id" TEXT NOT NULL,
    "kind" "LlmProviderKind" NOT NULL,
    "label" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "apiKeyLast4" TEXT NOT NULL,
    "baseUrl" TEXT,
    "model" TEXT NOT NULL,
    "dataRegion" TEXT,
    "zeroRetention" BOOLEAN NOT NULL DEFAULT false,
    "role" "LlmProviderRole" NOT NULL DEFAULT 'OFF',
    "fallbackOrder" INTEGER,
    "testedFingerprint" TEXT,
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastTestCode" TEXT,
    "lastTestLatencyMs" INTEGER,
    "lastTestById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_transfer_assessments" (
    "id" TEXT NOT NULL,
    "fileNumber" TEXT NOT NULL,
    "filedAt" TIMESTAMP(3) NOT NULL,
    "approvedById" TEXT NOT NULL,
    "note" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_transfer_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_call_lineage" (
    "id" TEXT NOT NULL,
    "sessionRef" TEXT,
    "userId" TEXT,
    "providerId" TEXT,
    "providerKind" "LlmProviderKind" NOT NULL,
    "model" TEXT NOT NULL,
    "dataRegion" TEXT,
    "outcome" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostMicroUsd" INTEGER,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_call_lineage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_providers_role_archivedAt_idx" ON "llm_providers"("role", "archivedAt");

-- CreateIndex
CREATE INDEX "llm_transfer_assessments_withdrawnAt_idx" ON "llm_transfer_assessments"("withdrawnAt");

-- CreateIndex
CREATE INDEX "llm_call_lineage_createdAt_idx" ON "llm_call_lineage"("createdAt");

-- CreateIndex
CREATE INDEX "llm_call_lineage_sessionRef_idx" ON "llm_call_lineage"("sessionRef");

-- CreateIndex
CREATE INDEX "llm_call_lineage_userId_createdAt_idx" ON "llm_call_lineage"("userId", "createdAt");


-- At most one active PRIMARY provider. An archived row never counts.
-- (Idempotent: the PostgreSQL spec re-applies this section on a scratch database built with `prisma db push`.)
CREATE UNIQUE INDEX IF NOT EXISTS "llm_providers_one_primary" ON "llm_providers" ((1))
  WHERE "role" = 'PRIMARY' AND "archivedAt" IS NULL;

-- A provider can hold a role only after a passing key test (testedFingerprint is set by that test).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'llm_providers_role_requires_test') THEN
    ALTER TABLE "llm_providers"
      ADD CONSTRAINT "llm_providers_role_requires_test"
      CHECK ("role" = 'OFF' OR "testedFingerprint" IS NOT NULL);
  END IF;
END $$;

-- The feature stays OFF until an administrator turns it on. A flag with no row would default to ON
-- (FeatureFlagsService.isEnabled is default-allow), so the row is inserted explicitly.
INSERT INTO "feature_flags" ("key","label","description","enabled","domain","rolloutPct","updatedAt")
VALUES ('ocr_import','Nhập từ ảnh scan bằng LLM','Đọc ảnh scan bằng LLM và điền vào form; cấu hình nhà cung cấp LLM',FALSE,'core',100,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
