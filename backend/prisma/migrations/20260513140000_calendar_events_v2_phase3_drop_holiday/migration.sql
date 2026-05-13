-- Calendar Events v2 — Phase 3 (PR 3): migrate Holiday rows to CalendarEvent, then drop Holiday.
-- Runs in a single transaction so partial migration cannot leave inconsistent state.
-- Per plan + PR 2a/2b verified production stable for 2 weeks; pre-deploy pg_dump backup covers rollback.

BEGIN;

-- ─── 1. Migrate 25 holiday rows into calendar_events ───────────────────────
-- Each holiday becomes a SYSTEM-scope CalendarEvent. Created by the first ADMIN
-- user (or any user — required FK). Category looked up by slug matching the old
-- enum value lowercase ('national' / 'police' / 'military' / 'international' / 'other').
-- `isRecurring=true` → `recurrenceRule='FREQ=YEARLY'` (matches seed semantics).
INSERT INTO "calendar_events" (
    "id",
    "title",
    "shortTitle",
    "description",
    "startDate",
    "allDay",
    "isOfficialDayOff",
    "lunarDate",
    "categoryId",
    "scope",
    "recurrenceRule",
    "createdById",
    "createdAt",
    "updatedAt"
)
SELECT
    h."id",
    h."title",
    h."shortTitle",
    h."description",
    h."date",
    true AS "allDay",
    h."isOfficialDayOff",
    h."lunarDate",
    (SELECT "id" FROM "event_categories" WHERE "slug" = lower(h."category"::text)) AS "categoryId",
    'SYSTEM'::"EventScope" AS "scope",
    CASE WHEN h."isRecurring" THEN 'FREQ=YEARLY' ELSE NULL END AS "recurrenceRule",
    (SELECT "id" FROM "users" WHERE "email" = 'admin@pc02.local' LIMIT 1) AS "createdById",
    h."createdAt",
    h."updatedAt"
FROM "holidays" h
-- Guard against re-running migration: skip rows whose id already exists in calendar_events.
WHERE NOT EXISTS (SELECT 1 FROM "calendar_events" ce WHERE ce."id" = h."id");

-- Verify the migration moved every row.
DO $$
DECLARE
    holiday_count INTEGER;
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO holiday_count FROM "holidays";
    SELECT COUNT(*) INTO migrated_count
        FROM "calendar_events"
        WHERE "scope" = 'SYSTEM' AND "createdById" IS NOT NULL;
    IF migrated_count < holiday_count THEN
        RAISE EXCEPTION 'Holiday migration incomplete: holidays=%, migrated SYSTEM events=%',
            holiday_count, migrated_count;
    END IF;
    RAISE NOTICE 'Holiday → CalendarEvent migration: % rows migrated', holiday_count;
END $$;

-- ─── 2. Drop the legacy holiday table + enum ───────────────────────────────
DROP TABLE "holidays";
DROP TYPE "HolidayCategory";

COMMIT;
