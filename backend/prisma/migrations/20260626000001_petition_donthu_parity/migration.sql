-- Field-parity bổ sung tab "Thông tin" form cũ /doi-1/Them (Đơn thư)
ALTER TABLE "petitions" ADD COLUMN "ngayDeXuat" TIMESTAMP(3);
ALTER TABLE "petitions" ADD COLUMN "phanLoaiNguonTin" TEXT;
ALTER TABLE "petitions" ADD COLUMN "dieuTraVien" TEXT;
