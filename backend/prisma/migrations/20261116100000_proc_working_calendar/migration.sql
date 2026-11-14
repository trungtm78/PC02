-- The working calendar deadlines are counted on: one row per year (weekly days off, DRAFT or CONFIRMED) and one row per
-- exception of that year (a day off, or a compensatory working day on a weekend). New tables and new enums only;
-- nothing existing is rewritten.

CREATE TYPE "ProcCalendarYearStatus" AS ENUM ('DRAFT', 'CONFIRMED');

CREATE TYPE "ProcCalendarDayKind" AS ENUM ('OFF', 'WORKING');

-- "weekendDays": JavaScript weekday numbers, 0 = Sunday, 1 = Monday, ... 6 = Saturday.
CREATE TABLE "proc_working_calendar_years" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "weekendDays" INTEGER[] DEFAULT ARRAY[6, 0]::INTEGER[],
    "status" "ProcCalendarYearStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "proc_working_calendar_years_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proc_working_calendar_years_year_key" ON "proc_working_calendar_years"("year");

CREATE TABLE "proc_working_calendar_days" (
    "id" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "ProcCalendarDayKind" NOT NULL,
    "label" TEXT,

    CONSTRAINT "proc_working_calendar_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proc_working_calendar_days_yearId_date_key" ON "proc_working_calendar_days"("yearId", "date");

ALTER TABLE "proc_working_calendar_days" ADD CONSTRAINT "proc_working_calendar_days_yearId_fkey"
  FOREIGN KEY ("yearId") REFERENCES "proc_working_calendar_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: 2026 and 2027 as DRAFT, with the FIXED solar public holidays only: 1 January, 30 April, 1 May, 2 September.
-- Lunar new year, Hung Kings day, the second National Day holiday and every compensatory day are NOT added here: those
-- depend on yearly government announcements and a person must enter them. That is also why both years stay DRAFT:
-- a person confirms a year once its days are complete.
-- Idempotent: a year or a day that is already there is left as it is.
INSERT INTO "proc_working_calendar_years" ("id", "year", "weekendDays", "status", "revision", "note", "createdAt", "updatedAt")
VALUES
  ('proc_wcy_seed_2026', 2026, ARRAY[6, 0]::INTEGER[], 'DRAFT', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('proc_wcy_seed_2027', 2027, ARRAY[6, 0]::INTEGER[], 'DRAFT', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("year") DO NOTHING;

INSERT INTO "proc_working_calendar_days" ("id", "yearId", "date", "kind", "label")
SELECT 'proc_wcd_seed_' || y."year" || '_' || h."monthDay",
       y."id",
       make_date(y."year", h."month", h."day"),
       'OFF'::"ProcCalendarDayKind",
       h."label"
FROM "proc_working_calendar_years" y
CROSS JOIN (
  VALUES
    ('0101', 1, 1, 'Tết Dương lịch'),
    ('0430', 4, 30, 'Ngày Giải phóng miền Nam, thống nhất đất nước'),
    ('0501', 5, 1, 'Ngày Quốc tế Lao động'),
    ('0902', 9, 2, 'Ngày Quốc khánh')
) AS h("monthDay", "month", "day", "label")
WHERE y."year" IN (2026, 2027)
ON CONFLICT ("yearId", "date") DO NOTHING;
