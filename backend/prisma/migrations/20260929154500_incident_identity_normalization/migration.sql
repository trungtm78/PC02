BEGIN;

ALTER TABLE "incidents"
  ADD COLUMN IF NOT EXISTS "sdt_nguoi_to_giac_norm" text,
  ADD COLUMN IF NOT EXISTS "cmnd_nguoi_to_giac_norm" text;

CREATE OR REPLACE FUNCTION pc02_dat_dinh_danh_incidents() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."sdt_nguoi_to_giac_norm" := regexp_replace(coalesce(NEW."sdtNguoiToGiac", ''), '[^0-9]', '', 'g');
  NEW."cmnd_nguoi_to_giac_norm" := regexp_replace(coalesce(NEW."cmndNguoiToGiac", ''), '[^0-9A-Za-z]', '', 'g');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_dinh_danh_incidents ON "incidents";
CREATE TRIGGER pc02_dinh_danh_incidents
  BEFORE INSERT OR UPDATE OF "sdtNguoiToGiac", "cmndNguoiToGiac" ON "incidents"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_dinh_danh_incidents();

UPDATE "incidents"
SET
  "sdt_nguoi_to_giac_norm" = regexp_replace(coalesce("sdtNguoiToGiac", ''), '[^0-9]', '', 'g'),
  "cmnd_nguoi_to_giac_norm" = regexp_replace(coalesce("cmndNguoiToGiac", ''), '[^0-9A-Za-z]', '', 'g')
WHERE
  "sdt_nguoi_to_giac_norm" IS DISTINCT FROM regexp_replace(coalesce("sdtNguoiToGiac", ''), '[^0-9]', '', 'g')
  OR "cmnd_nguoi_to_giac_norm" IS DISTINCT FROM regexp_replace(coalesce("cmndNguoiToGiac", ''), '[^0-9A-Za-z]', '', 'g');

CREATE INDEX IF NOT EXISTS "incidents_sdt_norm_trgm"
  ON "incidents" USING gin ("sdt_nguoi_to_giac_norm" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "incidents_cmnd_norm_trgm"
  ON "incidents" USING gin ("cmnd_nguoi_to_giac_norm" gin_trgm_ops);

COMMIT;
