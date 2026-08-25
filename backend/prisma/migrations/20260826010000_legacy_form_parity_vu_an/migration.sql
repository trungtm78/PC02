-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "baoCaoBanGiamDocText" TEXT,
ADD COLUMN     "canCuKhongKhoiTo" TEXT,
ADD COLUMN     "canCuTamDinhChiNguonTin" TEXT,
ADD COLUMN     "chuyenVuViecDonViKhac" TEXT,
ADD COLUMN     "khacPhucLyDoTDCVuViec" TEXT,
ADD COLUMN     "lenhNhapKho" TEXT,
ADD COLUMN     "lyDoKhongKhoiTo" TEXT[],
ADD COLUMN     "lyDoTamDinhChiNguonTin" TEXT[],
ADD COLUMN     "ngayHetThoiHieuVuViec" TIMESTAMP(3),
ADD COLUMN     "ngayPhucHoiNguonTin" TIMESTAMP(3),
ADD COLUMN     "ngayQDKhongKhoiTo" TIMESTAMP(3),
ADD COLUMN     "ngayQDPhanCongNguonTin" TIMESTAMP(3),
ADD COLUMN     "ngayQDTamDinhChiNguonTin" TIMESTAMP(3),
ADD COLUMN     "ngayXayRa" TIMESTAMP(3),
ADD COLUMN     "nhapVaoVuViecSo" TEXT,
ADD COLUMN     "noiLuuTruBaoQuan" TEXT,
ADD COLUMN     "noiXayRaPhuongXa" TEXT,
ADD COLUMN     "phanLoaiDanSu" TEXT,
ADD COLUMN     "phanLoaiNguonTinBanDau" TEXT,
ADD COLUMN     "soPhucHoiNguonTin" TEXT,
ADD COLUMN     "soQDKhongKhoiTo" TEXT,
ADD COLUMN     "soQDPhanCongNguonTin" TEXT,
ADD COLUMN     "soQDTamDinhChiNguonTin" TEXT,
ADD COLUMN     "tienDoKhacPhucTDCVuViec" TEXT,
ADD COLUMN     "toiDanhChinhKhoiToId" TEXT,
ADD COLUMN     "vatChungMoTa" TEXT,
ADD COLUMN     "vuViecTamDungTruoc2015" BOOLEAN;

-- AlterTable
ALTER TABLE "investigation_supplements" ADD COLUMN     "ngayTiepNhanDTBS" TIMESTAMP(3),
ADD COLUMN     "ngayTraHoSoToaAn" TIMESTAMP(3),
ADD COLUMN     "ngayTraHoSoVKS" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "cases_toiDanhChinhKhoiToId_idx" ON "cases"("toiDanhChinhKhoiToId");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_toiDanhChinhKhoiToId_fkey" FOREIGN KEY ("toiDanhChinhKhoiToId") REFERENCES "crimes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

