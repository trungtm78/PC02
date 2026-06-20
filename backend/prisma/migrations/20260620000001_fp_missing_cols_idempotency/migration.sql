-- PR-M2: field-parity cột còn thiếu + hạ tầng idempotent/raw cho tool di trú.
-- Folded Codex review: P1#1 (legacyRaw — không model nào ngoài Case có chỗ chứa raw),
-- P1#2 (legacySourceId unique để upsert thật), P1#3 (tier-3 thiếu legacySourceId),
-- P1#6/#9 (3 cờ xét-xử RIÊNG, nullable để phân biệt missing vs false).
-- Tất cả cột mới nullable / có default — an toàn trên DB có sẵn dữ liệu. KHÔNG CONCURRENTLY.
--
-- ⚠ PREFLIGHT (review data-migration + Codex P0): legacySourceId đã tồn tại (chỉ index thường từ
--   20260607000006); tool di trú trước đây CHƯA upsert theo unique → DB production có thể đã có row
--   legacySourceId TRÙNG. CREATE UNIQUE INDEX sẽ FAIL (rollback cả transaction). Các guard DO bên dưới
--   RAISE lỗi RÕ RÀNG (fail-closed, không mất data) thay vì lỗi unique khó hiểu. Nếu deploy dừng ở guard:
--   dedupe legacySourceId trùng rồi chạy lại.
--
-- ROLLBACK (tay, Prisma không auto-down):
--   DROP INDEX "cases_legacySourceId_key","petitions_legacySourceId_key","incidents_legacySourceId_key",
--     "lawyers_legacySourceId_key","proposals_legacySourceId_key","guidance_records_legacySourceId_key",
--     "exchanges_legacySourceId_key","delegations_legacySourceId_key";
--   CREATE INDEX "cases_legacySourceId_idx" ON "cases"("legacySourceId"); (+ petitions/incidents)
--   ALTER TABLE ... DROP COLUMN các cột mới bên dưới.

-- ── cases: ghi chú tự do + tội danh khác (multi) + raw + unique legacySourceId ──
ALTER TABLE "cases" ADD COLUMN "ghi_chu_khac" TEXT;
ALTER TABLE "cases" ADD COLUMN "toi_danh_khac_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "cases" ADD COLUMN "legacy_raw" JSONB;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "cases" WHERE "legacySourceId" IS NOT NULL GROUP BY "legacySourceId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Trùng cases.legacySourceId — dedupe trước khi tạo unique index (PR-M2 idempotency)';
  END IF;
END $$;
DROP INDEX "cases_legacySourceId_idx";
CREATE UNIQUE INDEX "cases_legacySourceId_key" ON "cases"("legacySourceId");

-- ── case_statistics: 3 cờ xét-xử RIÊNG (nullable — phân biệt thiếu vs false) ──
ALTER TABLE "case_statistics" ADD COLUMN "ghiAmGhiHinhDaDuocXetXu" BOOLEAN;
ALTER TABLE "case_statistics" ADD COLUMN "coSuDungKQGhiAmTrongXetXu" BOOLEAN;
ALTER TABLE "case_statistics" ADD COLUMN "khongGAGHNhungToaYeuCau" BOOLEAN;

-- ── petitions: raw + unique legacySourceId ──
ALTER TABLE "petitions" ADD COLUMN "legacyRaw" JSONB;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "petitions" WHERE "legacySourceId" IS NOT NULL GROUP BY "legacySourceId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Trùng petitions.legacySourceId — dedupe trước khi tạo unique index (PR-M2 idempotency)';
  END IF;
END $$;
DROP INDEX "petitions_legacySourceId_idx";
CREATE UNIQUE INDEX "petitions_legacySourceId_key" ON "petitions"("legacySourceId");

-- ── incidents: raw + unique legacySourceId ──
ALTER TABLE "incidents" ADD COLUMN "legacyRaw" JSONB;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "incidents" WHERE "legacySourceId" IS NOT NULL GROUP BY "legacySourceId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Trùng incidents.legacySourceId — dedupe trước khi tạo unique index (PR-M2 idempotency)';
  END IF;
END $$;
DROP INDEX "incidents_legacySourceId_idx";
CREATE UNIQUE INDEX "incidents_legacySourceId_key" ON "incidents"("legacySourceId");

-- ── tier-3 modules: legacySourceId + raw + unique (idempotent route 5 loại phan_loai) ──
-- (Chưa từng có legacySourceId → ADD mới, không cần guard trùng.)
ALTER TABLE "lawyers" ADD COLUMN "legacySourceId" TEXT;
ALTER TABLE "lawyers" ADD COLUMN "legacyRaw" JSONB;
CREATE UNIQUE INDEX "lawyers_legacySourceId_key" ON "lawyers"("legacySourceId");

ALTER TABLE "proposals" ADD COLUMN "legacySourceId" TEXT;
ALTER TABLE "proposals" ADD COLUMN "legacyRaw" JSONB;
CREATE UNIQUE INDEX "proposals_legacySourceId_key" ON "proposals"("legacySourceId");

ALTER TABLE "guidance_records" ADD COLUMN "legacySourceId" TEXT;
ALTER TABLE "guidance_records" ADD COLUMN "legacyRaw" JSONB;
CREATE UNIQUE INDEX "guidance_records_legacySourceId_key" ON "guidance_records"("legacySourceId");

ALTER TABLE "exchanges" ADD COLUMN "legacySourceId" TEXT;
ALTER TABLE "exchanges" ADD COLUMN "legacyRaw" JSONB;
CREATE UNIQUE INDEX "exchanges_legacySourceId_key" ON "exchanges"("legacySourceId");

ALTER TABLE "delegations" ADD COLUMN "legacySourceId" TEXT;
ALTER TABLE "delegations" ADD COLUMN "legacyRaw" JSONB;
CREATE UNIQUE INDEX "delegations_legacySourceId_key" ON "delegations"("legacySourceId");
