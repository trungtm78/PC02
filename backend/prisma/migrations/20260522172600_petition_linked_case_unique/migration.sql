-- P1-002 fix: Partial unique index trên petitions.linkedCaseId.
-- Prevents 2 petitions linking same case (catches double-convert race at DB level).
-- Frontend optimistic lock + DTO expectedUpdatedAt required = first line of defense.
-- This index = second line of defense (atomic DB constraint).
--
-- Pre-migration safety per ENG-2: assert no historical duplicates exist before adding constraint.
-- If duplicates found, this migration FAILS với clear message → ops cleanup manually trước retry.
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT "linkedCaseId"
    FROM petitions
    WHERE "linkedCaseId" IS NOT NULL
    GROUP BY "linkedCaseId"
    HAVING COUNT(*) > 1
  ) t;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'P1-002 PRE-MIGRATION CHECK FAILED: % duplicate linkedCaseId in petitions table. Manual cleanup required (orphan 1 petition per duplicate pair) before retry. Query: SELECT \"linkedCaseId\", COUNT(*) FROM petitions WHERE \"linkedCaseId\" IS NOT NULL GROUP BY \"linkedCaseId\" HAVING COUNT(*) > 1', dup_count;
  END IF;
END $$;

-- Partial unique: allows multiple NULL (petition not yet converted) but enforces uniqueness on non-null.
CREATE UNIQUE INDEX IF NOT EXISTS "petitions_linkedCaseId_unique"
  ON "petitions"("linkedCaseId")
  WHERE "linkedCaseId" IS NOT NULL;
