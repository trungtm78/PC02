-- PR-2: Truy nguyên di trú hệ cũ pc02hcm.com (additive, an toàn).
-- soHoSoCu (STT hệ cũ, tìm kiếm) + legacyId + legacyCollection (id trùng giữa collection).
-- Subject/InvestigationSupplement thêm khóa gốc để idempotent + truy nguyên nghi can/ĐTBS.

ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "soHoSoCu" TEXT, ADD COLUMN IF NOT EXISTS "legacyId" INTEGER, ADD COLUMN IF NOT EXISTS "legacyCollection" TEXT;
ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "soHoSoCu" TEXT, ADD COLUMN IF NOT EXISTS "legacyId" INTEGER, ADD COLUMN IF NOT EXISTS "legacyCollection" TEXT;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "soHoSoCu" TEXT, ADD COLUMN IF NOT EXISTS "legacyId" INTEGER, ADD COLUMN IF NOT EXISTS "legacyCollection" TEXT;
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "legacySourceId" TEXT, ADD COLUMN IF NOT EXISTS "legacyId" INTEGER, ADD COLUMN IF NOT EXISTS "legacyCollection" TEXT, ADD COLUMN IF NOT EXISTS "legacyRaw" JSONB;
ALTER TABLE "investigation_supplements" ADD COLUMN IF NOT EXISTS "legacySourceId" TEXT, ADD COLUMN IF NOT EXISTS "legacyId" INTEGER, ADD COLUMN IF NOT EXISTS "legacyCollection" TEXT;

CREATE INDEX IF NOT EXISTS "cases_soHoSoCu_idx" ON "cases"("soHoSoCu");
CREATE INDEX IF NOT EXISTS "cases_legacyId_legacyCollection_idx" ON "cases"("legacyId","legacyCollection");
CREATE INDEX IF NOT EXISTS "petitions_soHoSoCu_idx" ON "petitions"("soHoSoCu");
CREATE INDEX IF NOT EXISTS "petitions_legacyId_legacyCollection_idx" ON "petitions"("legacyId","legacyCollection");
CREATE INDEX IF NOT EXISTS "incidents_soHoSoCu_idx" ON "incidents"("soHoSoCu");
CREATE INDEX IF NOT EXISTS "incidents_legacyId_legacyCollection_idx" ON "incidents"("legacyId","legacyCollection");
CREATE INDEX IF NOT EXISTS "subjects_legacySourceId_idx" ON "subjects"("legacySourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "investigation_supplements_legacySourceId_key" ON "investigation_supplements"("legacySourceId");
