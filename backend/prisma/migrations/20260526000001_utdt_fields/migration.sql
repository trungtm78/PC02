-- v0.44: Ủy Thác Điều Tra (UTDT) fields
-- Điều 171 BLTTHS 2015 + TT 119/2021/TT-BCA + TT 28/2020/TT-BCA

-- Step 1: Add new enum values to case_provenance
ALTER TYPE "case_provenance" ADD VALUE IF NOT EXISTS 'UY_THAC_DIEU_TRA';

-- Step 2: Create case_type enum
DO $$ BEGIN
  CREATE TYPE "case_type" AS ENUM ('REGULAR', 'UY_THAC_DIEU_TRA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 3: Create loai_uy_thac enum
DO $$ BEGIN
  CREATE TYPE "loai_uy_thac" AS ENUM ('UY_THAC_DIEU_TRA', 'CHUYEN_DON_NGUON_TIN', 'UY_THAC_GIAI_QUYET');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 4: Add UTDT columns to cases table
ALTER TABLE "cases"
  ADD COLUMN IF NOT EXISTS "case_type"              "case_type" NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS "don_vi_giao"            TEXT,
  ADD COLUMN IF NOT EXISTS "so_quyet_dinh_uy_thac"  TEXT,
  ADD COLUMN IF NOT EXISTS "ngay_tiep_nhan"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "thoi_han_uy_thac"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "loai_uy_thac"           "loai_uy_thac",
  ADD COLUMN IF NOT EXISTS "ket_qua_uy_thac"        TEXT,
  ADD COLUMN IF NOT EXISTS "ngay_tra_ket_qua"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "loai_thong_tin"         TEXT;

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS "cases_case_type_idx" ON "cases"("case_type");
CREATE INDEX IF NOT EXISTS "cases_thoi_han_uy_thac_idx" ON "cases"("thoi_han_uy_thac");
CREATE INDEX IF NOT EXISTS "cases_don_vi_giao_idx" ON "cases"("don_vi_giao");

-- Step 6: Insert UTDT feature flag (idempotent)
INSERT INTO "feature_flags" ("key", "enabled", "label", "updatedAt")
VALUES ('uy-thac-dieu-tra', true, 'Ủy Thác Điều Tra', NOW())
ON CONFLICT ("key") DO NOTHING;
