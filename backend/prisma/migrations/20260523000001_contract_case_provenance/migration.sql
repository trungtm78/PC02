-- v0.37.2.0 Deploy-2 (Contract phase): Case provenance lock-in.
--
-- Phase 1 (Expand) shipped in 20260522230000 added nullable columns + DEFAULT.
-- Now lock the schema: backfill from linked Petitions/Incidents, SET NOT NULL,
-- VALIDATE the FK constraints, ADD CHECK constraint for source-type↔FK consistency.
--
-- Per plan v2.4 multi-phase deploy + eng review CRITICAL #2: this migration is
-- transactional. CHECK validation aborts cleanly if inconsistent data exists.
-- Backwards-compat shim in cases.service.create() removed in same PR.

-- ─────────────────────────────────────────────────────────
-- Step 1: Backfill caseProvenance from existing linked rows
-- ─────────────────────────────────────────────────────────
-- Precedence (per plan v2.4 + eng review):
--   1. Petition.linkedCaseId = Case.id → FROM_PETITION
--   2. Incident.linkedCaseId = Case.id → FROM_INCIDENT
--   3. Others: keep DEFAULT 'OTHER_LEGAL_SOURCE'

UPDATE "cases" c
SET "caseProvenance" = 'FROM_PETITION',
    "linkedPetitionId" = p.id
FROM "petitions" p
WHERE p."linkedCaseId" = c.id
  AND p."deletedAt" IS NULL
  AND c."caseProvenance" = 'OTHER_LEGAL_SOURCE'
  AND c."linkedPetitionId" IS NULL;

UPDATE "cases" c
SET "caseProvenance" = 'FROM_INCIDENT',
    "linkedIncidentId" = i.id
FROM "incidents" i
WHERE i."linkedCaseId" = c.id
  AND i."deletedAt" IS NULL
  AND c."caseProvenance" = 'OTHER_LEGAL_SOURCE'
  AND c."linkedIncidentId" IS NULL;

-- ─────────────────────────────────────────────────────────
-- Step 2: Lock schema — SET NOT NULL on caseProvenance
-- ─────────────────────────────────────────────────────────
-- Safe: every existing row now has a value (either backfill or DEFAULT).
ALTER TABLE "cases" ALTER COLUMN "caseProvenance" SET NOT NULL;

-- ─────────────────────────────────────────────────────────
-- Step 3: VALIDATE the FK constraints (skip validation phase
-- from Expand migration, validate now)
-- ─────────────────────────────────────────────────────────
ALTER TABLE "cases" VALIDATE CONSTRAINT "cases_linkedPetitionId_fkey";
ALTER TABLE "cases" VALIDATE CONSTRAINT "cases_linkedIncidentId_fkey";

-- ─────────────────────────────────────────────────────────
-- Step 4: Add CHECK constraint for source-type↔FK consistency
-- ─────────────────────────────────────────────────────────
-- Prevents future invalid combinations:
--   - FROM_PETITION must have linkedPetitionId (not linkedIncidentId)
--   - FROM_INCIDENT must have linkedIncidentId (not linkedPetitionId)
--   - Others must have neither FK
ALTER TABLE "cases"
  ADD CONSTRAINT case_provenance_fk_consistency CHECK (
    ("caseProvenance" = 'FROM_PETITION'
       AND "linkedPetitionId" IS NOT NULL
       AND "linkedIncidentId" IS NULL)
    OR
    ("caseProvenance" = 'FROM_INCIDENT'
       AND "linkedIncidentId" IS NOT NULL
       AND "linkedPetitionId" IS NULL)
    OR
    -- Non-linked provenance types: no FK required.
    -- SELF_SURRENDER + PROSECUTOR_PROPOSAL added in v0.37.2 PROV-002 (migration 20260523000001).
    -- This CHECK uses string list so it stays valid even when migration order interleaves.
    ("caseProvenance" IN ('DIRECT_DISCOVERY', 'TRANSFERRED', 'OTHER_LEGAL_SOURCE',
                          'SELF_SURRENDER', 'PROSECUTOR_PROPOSAL')
       AND "linkedPetitionId" IS NULL
       AND "linkedIncidentId" IS NULL)
  ) NOT VALID;

-- Validate against existing rows (will abort migration if any violation found)
ALTER TABLE "cases" VALIDATE CONSTRAINT case_provenance_fk_consistency;

-- ─────────────────────────────────────────────────────────
-- Step 5: Drop the DEFAULT now that NOT NULL is enforced
-- ─────────────────────────────────────────────────────────
-- New Cases MUST specify caseProvenance via DTO. Removing DEFAULT prevents
-- silent OTHER_LEGAL_SOURCE assignment for malformed payloads.
ALTER TABLE "cases" ALTER COLUMN "caseProvenance" DROP DEFAULT;
