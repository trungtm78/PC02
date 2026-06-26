-- Field-parity Vụ án thống kê: tổng số đối tượng + số lượng băng nhóm
ALTER TABLE "case_statistics" ADD COLUMN "soDoiTuong" INTEGER;
ALTER TABLE "case_statistics" ADD COLUMN "soBangNhom" INTEGER;
