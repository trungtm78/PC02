-- PR-8: Incident lyDoTamDinhChiVuViec enum single → enum[] (chọn nhiều căn cứ TĐC vụ việc Đ.148).
-- Enum type Postgres = "ly_do_tam_dinh_chi_vu_viec" (snake_case). Giữ data: NULL→{}, 1 giá trị→[giá trị].
DROP INDEX IF EXISTS "incidents_lyDoTamDinhChiVuViec_idx";
ALTER TABLE "incidents"
  ALTER COLUMN "lyDoTamDinhChiVuViec" TYPE "ly_do_tam_dinh_chi_vu_viec"[]
  USING (
    CASE WHEN "lyDoTamDinhChiVuViec" IS NULL
      THEN '{}'::"ly_do_tam_dinh_chi_vu_viec"[]
      ELSE ARRAY["lyDoTamDinhChiVuViec"]
    END
  );
ALTER TABLE "incidents" ALTER COLUMN "lyDoTamDinhChiVuViec" SET NOT NULL;
ALTER TABLE "incidents" ALTER COLUMN "lyDoTamDinhChiVuViec" SET DEFAULT '{}';
