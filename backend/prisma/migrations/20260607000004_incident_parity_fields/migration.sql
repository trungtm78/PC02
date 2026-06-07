-- Field-parity Vụ việc (giai đoạn nguồn tin). Nullable → an toàn. Plain DDL.
ALTER TABLE "incidents"
  ADD COLUMN "soQDPhanCongNguonTin" TEXT,
  ADD COLUMN "ngayQDPhanCongNguonTin" TIMESTAMP(3),
  ADD COLUMN "canCuKhongKhoiTo" TEXT,
  ADD COLUMN "canCuTamDinhChi" TEXT,
  ADD COLUMN "phanLoaiDanSuText" TEXT;
