-- Case tội danh chính chuẩn hoá như Petition: FK → crimes (master BLHS 2015).
-- Mở rộng: thêm cột nullable + FK SetNull, an toàn với dữ liệu hiện có.
ALTER TABLE "cases" ADD COLUMN "crimeChinhId" TEXT;
ALTER TABLE "cases" ADD CONSTRAINT "cases_crimeChinhId_fkey"
  FOREIGN KEY ("crimeChinhId") REFERENCES "crimes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "cases_crimeChinhId_idx" ON "cases"("crimeChinhId");
