-- legacySourceId: khóa gốc hệ thống cũ → idempotent re-run khi di trú. Nullable. Plain DDL.
ALTER TABLE "petitions" ADD COLUMN "legacySourceId" TEXT;
ALTER TABLE "incidents" ADD COLUMN "legacySourceId" TEXT;
ALTER TABLE "cases" ADD COLUMN "legacySourceId" TEXT;
CREATE INDEX "petitions_legacySourceId_idx" ON "petitions"("legacySourceId");
CREATE INDEX "incidents_legacySourceId_idx" ON "incidents"("legacySourceId");
CREATE INDEX "cases_legacySourceId_idx" ON "cases"("legacySourceId");
