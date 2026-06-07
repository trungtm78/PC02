-- Field-parity: thêm các field thiếu so với hệ thống cũ pc02hcm.com
-- Petition: thoiHanUTDT
-- Case: soKLDT, ngayKLDT, soQDDieuTraLai, ngayQDDieuTraLai
-- CaseStatistic: soLuongBiHai, soNguoiBiThuong, soLuongNguoiChet, soTienBiThietHai, soTienThuHoi, vuAnDaDuocXetXu
-- Incident: tienDoKhacPhucTDC

ALTER TABLE "petitions"
  ADD COLUMN IF NOT EXISTS "thoiHanUTDT" TIMESTAMP(3);

ALTER TABLE "cases"
  ADD COLUMN IF NOT EXISTS "soKLDT" TEXT,
  ADD COLUMN IF NOT EXISTS "ngayKLDT" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "soQDDieuTraLai" TEXT,
  ADD COLUMN IF NOT EXISTS "ngayQDDieuTraLai" TIMESTAMP(3);

ALTER TABLE "case_statistics"
  ADD COLUMN IF NOT EXISTS "soLuongBiHai" INTEGER,
  ADD COLUMN IF NOT EXISTS "soNguoiBiThuong" INTEGER,
  ADD COLUMN IF NOT EXISTS "soLuongNguoiChet" INTEGER,
  ADD COLUMN IF NOT EXISTS "soTienBiThietHai" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "soTienThuHoi" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "vuAnDaDuocXetXu" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "incidents"
  ADD COLUMN IF NOT EXISTS "tienDoKhacPhucTDC" TEXT;
