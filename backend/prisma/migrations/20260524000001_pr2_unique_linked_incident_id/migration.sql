-- PR 2 v0.38.1.0 — Enforce 1 Incident ↔ 1 Case strict
-- Eng-review D2 confirm: @unique trên Case.linkedIncidentId
-- Edge case "1 vụ việc tách 2 vụ án" → clone Incident với mã VV mới.

-- Verify no orphan rows trước khi add unique constraint
DO $$
DECLARE
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO duplicate_count FROM (
    SELECT "linkedIncidentId" FROM cases
    WHERE "linkedIncidentId" IS NOT NULL
    GROUP BY "linkedIncidentId"
    HAVING COUNT(*) > 1
  ) dup;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'PR 2 migration BLOCKED: % linkedIncidentId values appear in multiple cases. Resolve duplicates manually before applying @unique.', duplicate_count;
  END IF;
END $$;

-- CreateIndex (unique)
CREATE UNIQUE INDEX "cases_linkedIncidentId_key" ON "cases"("linkedIncidentId");
