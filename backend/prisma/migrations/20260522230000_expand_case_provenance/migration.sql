-- v0.37.1 Deploy-1 (Expand phase): Case provenance model
--
-- Background:
-- Original logic auto-created phantom Petition records when Case created with
-- metadata.petitionType. This violates BLTTHS Article 143 (traceability of
-- crime info sources) because the Petition has no corresponding citizen
-- petition document. /autoplan eng review flagged this as ship-blocker.
--
-- This migration adds nullable provenance columns + FKs NOT VALID + audit
-- table. PR-DATA will backfill existing rows; PR-PROV-2 (Contract) will
-- VALIDATE FKs + SET NOT NULL after 1-day soak.
--
-- This file is transactional (Prisma wraps in BEGIN/COMMIT). CONCURRENTLY
-- index creation is deferred to peer migration
-- 20260522230001_case_provenance_indexes_concurrent.

-- 1. CaseProvenance enum (5 values mapping to BLTTHS Đ.143 source types)
CREATE TYPE "case_provenance" AS ENUM (
  'FROM_PETITION',
  'FROM_INCIDENT',
  'DIRECT_DISCOVERY',
  'TRANSFERRED',
  'OTHER_LEGAL_SOURCE'
);

-- 2. Add nullable columns on "cases" with DEFAULT for backfill safety.
-- PG 11+ uses fast default (metadata-only), no table rewrite required.
ALTER TABLE "cases" ADD COLUMN "caseProvenance" "case_provenance" DEFAULT 'OTHER_LEGAL_SOURCE';
ALTER TABLE "cases" ADD COLUMN "linkedPetitionId" TEXT;
ALTER TABLE "cases" ADD COLUMN "linkedIncidentId" TEXT;
ALTER TABLE "cases" ADD COLUMN "sourceDocumentNote" TEXT;

-- 3. FK constraints NOT VALID — validation deferred to Deploy-2 (Contract).
-- onDelete RESTRICT: provenance must never be erased. App uses soft delete.
ALTER TABLE "cases" ADD CONSTRAINT "cases_linkedPetitionId_fkey"
  FOREIGN KEY ("linkedPetitionId") REFERENCES "petitions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "cases" ADD CONSTRAINT "cases_linkedIncidentId_fkey"
  FOREIGN KEY ("linkedIncidentId") REFERENCES "incidents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- 4. Audit table for backfill tracking.
-- PR-DATA scripts/backfill-case-provenance.ts will populate this table with
-- one row per Case showing which provenance signal was detected and any
-- inconsistencies (e.g., metadata.petitionType present without linked Petition).
-- Pattern follows existing audit table: 20260520120000_audit_pii_sanitize_backfill.
CREATE TABLE "case_provenance_backfill_audit" (
  "case_id" TEXT PRIMARY KEY,
  "detected_source" TEXT NOT NULL,
  "inconsistency" TEXT,
  "metadata_snapshot" JSONB,
  "backfilled_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "case_provenance_backfill_audit_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE
);

CREATE INDEX "case_provenance_backfill_audit_detected_source_idx"
  ON "case_provenance_backfill_audit"("detected_source");

CREATE INDEX "case_provenance_backfill_audit_inconsistency_idx"
  ON "case_provenance_backfill_audit"("inconsistency")
  WHERE "inconsistency" IS NOT NULL;
