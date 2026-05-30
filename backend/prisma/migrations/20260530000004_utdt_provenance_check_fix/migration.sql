-- v0.67.2.0 hotfix: UY_THAC_DIEU_TRA fails case_provenance_fk_consistency CHECK
--
-- Bug: Migration 20260526000001_utdt_fields added 'UY_THAC_DIEU_TRA' to the
-- case_provenance enum but did NOT update case_provenance_fk_consistency CHECK
-- (added in 20260523000001_contract_case_provenance). Result: every attempt to
-- create a Case with caseProvenance='UY_THAC_DIEU_TRA' is rejected by Postgres
-- with "new row violates check constraint", surfaced to the UI as the generic
-- alert "Lưu hồ sơ thất bại. Vui lòng thử lại."
--
-- UTDT is a non-linked provenance (no linkedPetitionId / linkedIncidentId — it
-- represents an investigation entrusted from another unit per Điều 171 BLTTHS
-- 2015), so it belongs in the same branch as DIRECT_DISCOVERY/TRANSFERRED/etc.
--
-- Why no test caught this: backend specs mock Prisma; CHECK constraint
-- violations only surface against a real Postgres instance.

ALTER TABLE "cases"
  DROP CONSTRAINT IF EXISTS case_provenance_fk_consistency;

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
    -- UY_THAC_DIEU_TRA added in v0.67.2.0 hotfix (migration 20260530000004).
    ("caseProvenance" IN ('DIRECT_DISCOVERY', 'TRANSFERRED', 'OTHER_LEGAL_SOURCE',
                          'SELF_SURRENDER', 'PROSECUTOR_PROPOSAL',
                          'UY_THAC_DIEU_TRA')
       AND "linkedPetitionId" IS NULL
       AND "linkedIncidentId" IS NULL)
  );
