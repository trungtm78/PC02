-- Preserve every original/corrected relation. Establish active uniqueness before
-- removing the old global uniqueness so inactive history never blocks a new link.
CREATE UNIQUE INDEX "case_relations_active_pair_type_key"
ON "case_relations"("sourceCaseId", "targetCaseId", "type")
WHERE "revokedAt" IS NULL AND "deletedAt" IS NULL;

CREATE INDEX "case_relations_sourceCaseId_targetCaseId_type_idx"
ON "case_relations"("sourceCaseId", "targetCaseId", "type");

DROP INDEX "case_relations_sourceCaseId_targetCaseId_type_key";
