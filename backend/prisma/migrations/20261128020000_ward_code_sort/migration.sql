-- The list sorts "Mã" as a NUMBER. The code is text (`2026-8`, `2026-21`): sorted as text, 2026-8 comes after 2026-21.
-- As `sttSort` of the petitions: a number kept by a trigger, used only to order by. year * 100000 + number for a
-- code of the series' own form; NULL for anything else (a code of another form sinks to the end, it never fails a write).
ALTER TABLE "ward_assignments" ADD COLUMN IF NOT EXISTS "codeSort" INTEGER;

CREATE OR REPLACE FUNCTION pc02_ward_code_sort() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."code" ~ '^[0-9]{4}-[0-9]{1,5}$' THEN
    NEW."codeSort" := split_part(NEW."code", '-', 1)::integer * 100000 + split_part(NEW."code", '-', 2)::integer;
  ELSE
    NEW."codeSort" := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_ward_code_sort ON "ward_assignments";
CREATE TRIGGER pc02_ward_code_sort
  BEFORE INSERT OR UPDATE OF "code" ON "ward_assignments"
  FOR EACH ROW EXECUTE FUNCTION pc02_ward_code_sort();

-- The requests that already carry a code.
UPDATE "ward_assignments"
SET "codeSort" = split_part("code", '-', 1)::integer * 100000 + split_part("code", '-', 2)::integer
WHERE "code" ~ '^[0-9]{4}-[0-9]{1,5}$';

CREATE INDEX IF NOT EXISTS "ward_assignments_codeSort_idx" ON "ward_assignments" ("codeSort");
