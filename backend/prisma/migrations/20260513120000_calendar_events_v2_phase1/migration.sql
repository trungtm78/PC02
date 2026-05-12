-- Calendar Events v2 — Phase 1 (PR 1)
-- Adds new tables parallel to existing Holiday. Holiday stays untouched in this PR.
-- Migrate data + drop Holiday will happen in PR 3 after PR 2 verified stable.
-- See plan: ~/.claude/plans/hi-n-ch-c-n-ng-mapping-serene-tiger.md (PR 1 section)

-- ─── Enums ──────────────────────────────────────────────────────────────────
CREATE TYPE "EventScope" AS ENUM ('SYSTEM', 'TEAM', 'PERSONAL');
CREATE TYPE "ReminderChannel" AS ENUM ('FCM', 'EMAIL');

-- ─── EventCategory ──────────────────────────────────────────────────────────
CREATE TABLE "event_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "event_categories_slug_key" ON "event_categories"("slug");
CREATE INDEX "event_categories_sortOrder_idx" ON "event_categories"("sortOrder");

-- ─── CalendarEvent ──────────────────────────────────────────────────────────
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "startTime" TEXT,
    "endTime" TEXT,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "isOfficialDayOff" BOOLEAN NOT NULL DEFAULT false,
    "lunarDate" TEXT,
    "categoryId" TEXT NOT NULL,
    "scope" "EventScope" NOT NULL,
    "teamId" TEXT,
    "userId" TEXT,
    "recurrenceRule" TEXT,
    "recurrenceEndDate" DATE,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "calendar_events_startDate_idx" ON "calendar_events"("startDate");
CREATE INDEX "calendar_events_categoryId_idx" ON "calendar_events"("categoryId");
CREATE INDEX "calendar_events_deletedAt_idx" ON "calendar_events"("deletedAt");

-- Partial indexes for hot query paths (Eng review fix #9 — composite scope+teamId has poor
-- selectivity for SYSTEM since teamId IS NULL). These are not expressible in Prisma schema
-- and must be raw SQL.
CREATE INDEX "calendar_events_system_startDate_partial_idx"
    ON "calendar_events"("startDate")
    WHERE "scope" = 'SYSTEM' AND "deletedAt" IS NULL;
CREATE INDEX "calendar_events_team_startDate_partial_idx"
    ON "calendar_events"("startDate", "teamId")
    WHERE "scope" = 'TEAM' AND "deletedAt" IS NULL;
CREATE INDEX "calendar_events_personal_startDate_partial_idx"
    ON "calendar_events"("startDate", "userId")
    WHERE "scope" = 'PERSONAL' AND "deletedAt" IS NULL;

-- ─── CalendarEventOccurrenceOverride ────────────────────────────────────────
CREATE TABLE "calendar_event_occurrence_overrides" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurrenceDate" DATE NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "overrideFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calendar_event_occurrence_overrides_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "calendar_event_occurrence_overrides_eventId_occurrenceDate_key"
    ON "calendar_event_occurrence_overrides"("eventId", "occurrenceDate");
CREATE INDEX "calendar_event_occurrence_overrides_eventId_idx"
    ON "calendar_event_occurrence_overrides"("eventId");

-- ─── EventReminder ──────────────────────────────────────────────────────────
CREATE TABLE "event_reminders" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minutesBefore" INTEGER NOT NULL,
    "channels" "ReminderChannel"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_reminders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_reminders_eventId_idx" ON "event_reminders"("eventId");
CREATE INDEX "event_reminders_userId_idx" ON "event_reminders"("userId");

-- ─── EventReminderDispatch ──────────────────────────────────────────────────
CREATE TABLE "event_reminder_dispatches" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "occurrenceDate" DATE NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channels" "ReminderChannel"[],
    CONSTRAINT "event_reminder_dispatches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "event_reminder_dispatches_reminderId_occurrenceDate_key"
    ON "event_reminder_dispatches"("reminderId", "occurrenceDate");
CREATE INDEX "event_reminder_dispatches_reminderId_idx" ON "event_reminder_dispatches"("reminderId");
CREATE INDEX "event_reminder_dispatches_sentAt_idx" ON "event_reminder_dispatches"("sentAt");

-- ─── Foreign Keys ───────────────────────────────────────────────────────────
ALTER TABLE "calendar_events"
    ADD CONSTRAINT "calendar_events_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "event_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
    ADD CONSTRAINT "calendar_events_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "teams"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
    ADD CONSTRAINT "calendar_events_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
    ADD CONSTRAINT "calendar_events_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
    ADD CONSTRAINT "calendar_events_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calendar_event_occurrence_overrides"
    ADD CONSTRAINT "calendar_event_occurrence_overrides_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_reminders"
    ADD CONSTRAINT "event_reminders_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_reminders"
    ADD CONSTRAINT "event_reminders_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_reminder_dispatches"
    ADD CONSTRAINT "event_reminder_dispatches_reminderId_fkey"
    FOREIGN KEY ("reminderId") REFERENCES "event_reminders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
