-- PR-8: Incident lyDoKhongKhoiTo enum single → enum[] (chọn nhiều căn cứ Đ.157).
-- Enum type Postgres = "LyDoKhongKhoiTo" (PascalCase). Giữ data: NULL→{}, 1 giá trị→[giá trị].
ALTER TABLE "incidents"
  ALTER COLUMN "lyDoKhongKhoiTo" TYPE "LyDoKhongKhoiTo"[]
  USING (
    CASE WHEN "lyDoKhongKhoiTo" IS NULL
      THEN '{}'::"LyDoKhongKhoiTo"[]
      ELSE ARRAY["lyDoKhongKhoiTo"]
    END
  );
ALTER TABLE "incidents" ALTER COLUMN "lyDoKhongKhoiTo" SET NOT NULL;
ALTER TABLE "incidents" ALTER COLUMN "lyDoKhongKhoiTo" SET DEFAULT '{}';
