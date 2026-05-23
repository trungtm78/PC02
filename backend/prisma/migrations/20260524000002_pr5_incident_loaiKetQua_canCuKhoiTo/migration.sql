-- PR 5 v0.38.4.0 — Incident: thêm loaiKetQua + canCuKhoiToCode (additive nullable)
-- Wireframe 5 plan twinkly-crescent: section "Kết quả giải quyết" hoàn thiện
-- Entry path 3: khi loaiKetQua='KHOI_TO' + Save → modal prompt "Tạo Case ngay/Để sau"

ALTER TABLE "incidents"
  ADD COLUMN IF NOT EXISTS "loaiKetQua" TEXT,
  ADD COLUMN IF NOT EXISTS "canCuKhoiToCode" TEXT;

-- Optional index for reporting queries by result type
CREATE INDEX IF NOT EXISTS "incidents_loaiKetQua_idx" ON "incidents"("loaiKetQua");
