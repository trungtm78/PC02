-- Migration: 20260227000004_investigation_supplements
-- Add InvestigationSupplement model for tracking supplementary/re-investigation records
-- TASK-2026-0227-001

CREATE TABLE "investigation_supplements" (
  "id"             TEXT NOT NULL,
  "caseId"         TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "decisionNumber" TEXT NOT NULL,
  "decisionDate"   TIMESTAMP(3),
  "reason"         TEXT NOT NULL,
  "deadline"       TIMESTAMP(3),
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "investigation_supplements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "investigation_supplements_caseId_idx" ON "investigation_supplements"("caseId");
CREATE INDEX "investigation_supplements_createdAt_idx" ON "investigation_supplements"("createdAt");

ALTER TABLE "investigation_supplements"
  ADD CONSTRAINT "investigation_supplements_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "cases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investigation_supplements"
  ADD CONSTRAINT "investigation_supplements_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
