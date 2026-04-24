-- Sprint 2: GAP-5 (BLHS 2015 Điều 9) + GAP-6 (BLTTHS Điều 157)
-- Creates CapDoToiPham + LyDoKhongKhoiTo enums, adds fields to cases/incidents

-- CreateEnum: CapDoToiPham (BLHS 2015 Điều 9)
CREATE TYPE "CapDoToiPham" AS ENUM (
  'IT_NGHIEM_TRONG',
  'NGHIEM_TRONG',
  'RAT_NGHIEM_TRONG',
  'DAC_BIET_NGHIEM_TRONG'
);

-- CreateEnum: LyDoKhongKhoiTo (BLTTHS 2015 Điều 157)
CREATE TYPE "LyDoKhongKhoiTo" AS ENUM (
  'KHONG_CO_SU_VIEC',
  'HANH_VI_KHONG_CAU_THANH_TOI_PHAM',
  'NGUOI_THUC_HIEN_CHUA_DU_TUOI',
  'NGUOI_PHAM_TOI_CHET',
  'HET_THOI_HIEU',
  'TOI_PHAM_DA_DUOC_XOA_AN_TICH',
  'TRUONG_HOP_KHAC'
);

-- AlterTable cases: add capDoToiPham + ngayKhoiTo
-- One-off data migration: copy metadata->>'severity' → capDoToiPham for existing rows
ALTER TABLE "cases"
  ADD COLUMN "capDoToiPham" "CapDoToiPham",
  ADD COLUMN "ngayKhoiTo"   TIMESTAMP(3);

UPDATE "cases"
SET "capDoToiPham" = CASE metadata->>'severity'
  WHEN 'IT_NGHIEM_TRONG'       THEN 'IT_NGHIEM_TRONG'::"CapDoToiPham"
  WHEN 'NGHIEM_TRONG'          THEN 'NGHIEM_TRONG'::"CapDoToiPham"
  WHEN 'RAT_NGHIEM_TRONG'      THEN 'RAT_NGHIEM_TRONG'::"CapDoToiPham"
  WHEN 'DAC_BIET_NGHIEM_TRONG' THEN 'DAC_BIET_NGHIEM_TRONG'::"CapDoToiPham"
  ELSE NULL
END
WHERE metadata IS NOT NULL AND metadata->>'severity' IS NOT NULL;

-- AlterTable incidents: convert lyDoKhongKhoiTo String? → LyDoKhongKhoiTo?
ALTER TABLE "incidents"
  ALTER COLUMN "lyDoKhongKhoiTo" TYPE "LyDoKhongKhoiTo"
  USING CASE "lyDoKhongKhoiTo"
    WHEN 'KHONG_CO_SU_VIEC'                  THEN 'KHONG_CO_SU_VIEC'::"LyDoKhongKhoiTo"
    WHEN 'HANH_VI_KHONG_CAU_THANH_TOI_PHAM'  THEN 'HANH_VI_KHONG_CAU_THANH_TOI_PHAM'::"LyDoKhongKhoiTo"
    WHEN 'NGUOI_THUC_HIEN_CHUA_DU_TUOI'      THEN 'NGUOI_THUC_HIEN_CHUA_DU_TUOI'::"LyDoKhongKhoiTo"
    WHEN 'NGUOI_PHAM_TOI_CHET'               THEN 'NGUOI_PHAM_TOI_CHET'::"LyDoKhongKhoiTo"
    WHEN 'HET_THOI_HIEU'                     THEN 'HET_THOI_HIEU'::"LyDoKhongKhoiTo"
    WHEN 'TOI_PHAM_DA_DUOC_XOA_AN_TICH'     THEN 'TOI_PHAM_DA_DUOC_XOA_AN_TICH'::"LyDoKhongKhoiTo"
    WHEN 'TRUONG_HOP_KHAC'                   THEN 'TRUONG_HOP_KHAC'::"LyDoKhongKhoiTo"
    ELSE NULL
  END;
