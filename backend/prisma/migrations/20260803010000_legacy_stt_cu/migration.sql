-- Hiển thị/tìm kiếm STT cũ hơn (trường stt_cu hệ cũ) song song soHoSoCu (stt).
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "sttCu" TEXT;
ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "sttCu" TEXT;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "sttCu" TEXT;
CREATE INDEX IF NOT EXISTS "cases_sttCu_idx" ON "cases"("sttCu");
CREATE INDEX IF NOT EXISTS "petitions_sttCu_idx" ON "petitions"("sttCu");
CREATE INDEX IF NOT EXISTS "incidents_sttCu_idx" ON "incidents"("sttCu");
