-- Consolidate epic (feat/consolidate-legacy-native-fields): thăng native metadata field → cột typed.
-- Trước đây các field này chỉ nằm trong Case.metadata JSON (không query được). Additive, idempotent.
-- Backfill dữ liệu từ metadata ở cli/backfill-consolidate.ts (chỉ-khi-cột-rỗng + bảng conflict/reject).

ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "reporterDateOfBirth" TIMESTAMP(3);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "reporterDateOfBirthPrecision" TEXT;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "receiveDate" TIMESTAMP(3);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "caseClassification" TEXT;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "tinhTrang" TEXT;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "toiDanhBanDau" TEXT;
