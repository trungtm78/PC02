-- Team lifecycle: three states (ACTIVE / INACTIVE / ARCHIVED) instead of the single `isActive` flag.
-- `isActive` stays, because seeds, the legacy migration and older code still write it; the trigger below keeps the two
-- representations of the same state from ever disagreeing.

CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

ALTER TABLE "teams"
  ADD COLUMN "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedById" TEXT;

-- Existing rows: a team that was switched off keeps being "paused", nothing is archived by the migration.
UPDATE "teams" SET "status" = 'INACTIVE' WHERE "isActive" = false;

CREATE INDEX "teams_status_idx" ON "teams"("status");

-- TRIGGER-SECTION: everything below is re-applied by the database spec (the CI scratch schema is built with
-- `prisma db push`, which creates the columns but not triggers).
CREATE OR REPLACE FUNCTION teams_status_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'ACTIVE' THEN
      NEW."isActive" := false;
    ELSIF NEW."isActive" = false THEN
      NEW."status" := 'INACTIVE';
    END IF;
  ELSE
    IF NEW."status" IS DISTINCT FROM OLD."status" THEN
      NEW."isActive" := (NEW."status" = 'ACTIVE');
    ELSIF NEW."isActive" IS DISTINCT FROM OLD."isActive" THEN
      NEW."status" := CASE WHEN NEW."isActive" THEN 'ACTIVE'::"TeamStatus" ELSE 'INACTIVE'::"TeamStatus" END;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS teams_status_sync ON "teams";
CREATE TRIGGER teams_status_sync
  BEFORE INSERT OR UPDATE ON "teams"
  FOR EACH ROW EXECUTE FUNCTION teams_status_sync();
