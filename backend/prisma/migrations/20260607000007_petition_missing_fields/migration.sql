-- Migration: thêm 4 field parity thiếu trong bảng petitions
-- noiXayRaPhuongXa, ngayXayRa, loaiToiPham, phuongThucThuDoan
-- (đối chiếu hệ thống cũ pc02hcm.com/doi-1/Them)

ALTER TABLE "petitions"
  ADD COLUMN IF NOT EXISTS "noiXayRaPhuongXa" TEXT,
  ADD COLUMN IF NOT EXISTS "ngayXayRa" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "loaiToiPham" TEXT,
  ADD COLUMN IF NOT EXISTS "phuongThucThuDoan" TEXT;
