-- Field-parity Vụ việc: QĐ không khởi tố riêng + cờ xác định tạm dừng giải quyết
ALTER TABLE "incidents" ADD COLUMN "soQDKhongKhoiTo" TEXT;
ALTER TABLE "incidents" ADD COLUMN "ngayQDKhongKhoiTo" TIMESTAMP(3);
ALTER TABLE "incidents" ADD COLUMN "xacDinhVuViecTamDung" BOOLEAN NOT NULL DEFAULT false;
