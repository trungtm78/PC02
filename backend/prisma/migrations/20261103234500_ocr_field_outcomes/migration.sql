-- What became of each field a reading filled, recorded when the record is saved. Names and outcomes only.
CREATE TYPE "OcrFieldOutcomeKind" AS ENUM ('KEPT', 'EDITED', 'CLEARED');

CREATE TABLE "ocr_field_outcomes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "entity" "OcrEntity" NOT NULL,
    "field" TEXT NOT NULL,
    "outcome" "OcrFieldOutcomeKind" NOT NULL,
    "mustConfirm" BOOLEAN NOT NULL DEFAULT false,
    "providerKind" "LlmProviderKind",
    "model" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_field_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ocr_field_outcomes_createdAt_idx" ON "ocr_field_outcomes"("createdAt");
CREATE INDEX "ocr_field_outcomes_entity_field_idx" ON "ocr_field_outcomes"("entity", "field");
CREATE INDEX "ocr_field_outcomes_sessionId_idx" ON "ocr_field_outcomes"("sessionId");
