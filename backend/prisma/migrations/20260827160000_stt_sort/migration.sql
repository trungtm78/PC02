-- Cột SỐ để sắp danh sách theo mã hồ sơ ("STT").
--
-- Mã hồ sơ là CHUỖI dạng "2026-11171". Sắp thẳng trên chuỗi ra sai thứ tự: "2026-9395" đứng
-- sau "2026-11171" vì so từng ký tự, dù 9395 nhỏ hơn 11171. Cột này giữ số tương ứng để sắp.
--
-- Tính ở tầng CƠ SỞ DỮ LIỆU chứ không ở tầng ứng dụng: mã được sinh ở nhiều đường — tạo tay,
-- di trú, nhập Excel, chuyển hồ sơ sang thực thể khác — nên tính trong mã nguồn thì kiểu gì
-- cũng sót một đường, và sót thì hồ sơ ấy tụt xuống cuối danh sách mà không ai biết vì sao.
--
-- Mã không đúng dạng "năm-số" cho ra NULL (đo 27/08/2026: đơn thư 426, vụ việc 250, vụ án
-- 330 — trong đó 218 mã rỗng). Truy vấn sắp kèm NULLS LAST nên chúng nằm cuối thay vì chiếm
-- đầu danh sách.

CREATE OR REPLACE FUNCTION pc02_stt_sort(ma text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN ma ~ '^[0-9]{4}-[0-9]+$'
      THEN split_part(ma, '-', 1)::bigint * 10000000 + split_part(ma, '-', 2)::bigint
    ELSE NULL
  END
$$;

ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "sttSort" BIGINT;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "sttSort" BIGINT;
ALTER TABLE "cases"     ADD COLUMN IF NOT EXISTS "sttSort" BIGINT;

CREATE OR REPLACE FUNCTION pc02_dat_stt_sort_petitions() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."sttSort" := pc02_stt_sort(NEW."stt");
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION pc02_dat_stt_sort_incidents() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."sttSort" := pc02_stt_sort(NEW."code");
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION pc02_dat_stt_sort_cases() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."sttSort" := pc02_stt_sort(NEW."caseCode");
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_stt_sort_petitions ON "petitions";
CREATE TRIGGER pc02_stt_sort_petitions
  BEFORE INSERT OR UPDATE OF "stt" ON "petitions"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_stt_sort_petitions();

DROP TRIGGER IF EXISTS pc02_stt_sort_incidents ON "incidents";
CREATE TRIGGER pc02_stt_sort_incidents
  BEFORE INSERT OR UPDATE OF "code" ON "incidents"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_stt_sort_incidents();

DROP TRIGGER IF EXISTS pc02_stt_sort_cases ON "cases";
CREATE TRIGGER pc02_stt_sort_cases
  BEFORE INSERT OR UPDATE OF "caseCode" ON "cases"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_stt_sort_cases();

-- Bù cho hồ sơ đã có sẵn (54.736 hồ sơ tính tới 27/08/2026).
UPDATE "petitions" SET "sttSort" = pc02_stt_sort("stt")         WHERE "sttSort" IS NULL;
UPDATE "incidents" SET "sttSort" = pc02_stt_sort("code")        WHERE "sttSort" IS NULL;
UPDATE "cases"     SET "sttSort" = pc02_stt_sort("caseCode")    WHERE "sttSort" IS NULL;

-- Chỉ mục thường, KHÔNG dùng CONCURRENTLY: Prisma chạy mỗi bản di trú trong một giao dịch,
-- mà CONCURRENTLY không chạy được trong giao dịch — đã làm hỏng deploy hai lần ở v0.40.
CREATE INDEX IF NOT EXISTS "petitions_sttSort_idx" ON "petitions" ("sttSort");
CREATE INDEX IF NOT EXISTS "incidents_sttSort_idx" ON "incidents" ("sttSort");
CREATE INDEX IF NOT EXISTS "cases_sttSort_idx"     ON "cases"     ("sttSort");
