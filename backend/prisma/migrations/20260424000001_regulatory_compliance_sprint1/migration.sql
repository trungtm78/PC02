-- Migration: Regulatory Compliance Sprint 1 (BLTTHS 2015 Điều 144, 147)
-- GAP-1: loaiDonVu String → LoaiNguonTin enum (Điều 144: 3 nguồn tin)
-- GAP-2: soLanGiaHan + ngayGiaHan columns (Điều 147: gia hạn tối đa 2 lần)
-- GAP-4: petitionType String → LoaiDon enum (Luật Tố cáo 2018 / Khiếu nại 2011)

-- CreateEnum: LoaiNguonTin (Điều 144 BLTTHS 2015)
CREATE TYPE "LoaiNguonTin" AS ENUM ('TO_GIAC', 'TIN_BAO', 'KIEN_NGHI_KHOI_TO');

-- CreateEnum: LoaiDon (Luật Tố cáo 2018 / Luật Khiếu nại 2011)
CREATE TYPE "LoaiDon" AS ENUM ('TO_CAO', 'KHIEU_NAI', 'KIEN_NGHI', 'PHAN_ANH');

-- AlterTable incidents: loaiDonVu String → LoaiNguonTin enum
-- DB is fresh (dev/test only) so CASE-WHEN is safe; unknown values → NULL
ALTER TABLE "incidents"
  ALTER COLUMN "loaiDonVu" TYPE "LoaiNguonTin"
  USING CASE "loaiDonVu"
    WHEN 'TO_GIAC'            THEN 'TO_GIAC'::"LoaiNguonTin"
    WHEN 'TIN_BAO'            THEN 'TIN_BAO'::"LoaiNguonTin"
    WHEN 'KIEN_NGHI_KHOI_TO'  THEN 'KIEN_NGHI_KHOI_TO'::"LoaiNguonTin"
    ELSE NULL
  END;

-- AlterTable incidents: add soLanGiaHan + ngayGiaHan (Điều 147 khoản 2-3)
ALTER TABLE "incidents"
  ADD COLUMN "soLanGiaHan" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ngayGiaHan"  TIMESTAMP(3);

-- AlterTable petitions: petitionType String → LoaiDon enum
ALTER TABLE "petitions"
  ALTER COLUMN "petitionType" TYPE "LoaiDon"
  USING CASE "petitionType"
    WHEN 'TO_CAO'    THEN 'TO_CAO'::"LoaiDon"
    WHEN 'KHIEU_NAI' THEN 'KHIEU_NAI'::"LoaiDon"
    WHEN 'KIEN_NGHI' THEN 'KIEN_NGHI'::"LoaiDon"
    WHEN 'PHAN_ANH'  THEN 'PHAN_ANH'::"LoaiDon"
    ELSE NULL
  END;
