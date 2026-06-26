-- PR-8: Case lyDoTamDinhChiVuAn enum single → enum[] (chọn nhiều lý do TĐC Đ.229).
-- Enum type Postgres = "ly_do_tam_dinh_chi_vu_an" (snake_case). Giữ data: NULL→{}, 1 giá trị→[giá trị].
DROP INDEX IF EXISTS "cases_lyDoTamDinhChiVuAn_idx";
ALTER TABLE "cases"
  ALTER COLUMN "lyDoTamDinhChiVuAn" TYPE "ly_do_tam_dinh_chi_vu_an"[]
  USING (
    CASE WHEN "lyDoTamDinhChiVuAn" IS NULL
      THEN '{}'::"ly_do_tam_dinh_chi_vu_an"[]
      ELSE ARRAY["lyDoTamDinhChiVuAn"]
    END
  );
ALTER TABLE "cases" ALTER COLUMN "lyDoTamDinhChiVuAn" SET NOT NULL;
ALTER TABLE "cases" ALTER COLUMN "lyDoTamDinhChiVuAn" SET DEFAULT '{}';
