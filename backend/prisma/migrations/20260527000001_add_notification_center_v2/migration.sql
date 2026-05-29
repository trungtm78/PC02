-- Migration: add-notification-center-v2
-- Adds push delivery tracking + acknowledge flow to Notification model,
-- adds NotificationPreference model, adds assignedToId to Delegation,
-- and adds 6 new NotificationType enum values.

-- Step 1: Add new enum values to NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INCIDENT_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PETITION_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'UTDT_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INCIDENT_CREATED';

-- Step 2: Add push delivery + acknowledge fields to Notification
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "acknowledgedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pushSentAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pushRetryCount"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pushNextRetryAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pushMaxRetries"  INTEGER NOT NULL DEFAULT 3;

-- Indexes for scheduler performance (plain CREATE INDEX — no CONCURRENTLY per lesson v0.40)
CREATE INDEX IF NOT EXISTS "notifications_pushNextRetryAt_idx" ON "notifications"("pushNextRetryAt");
CREATE INDEX IF NOT EXISTS "notifications_acknowledgedAt_idx"  ON "notifications"("acknowledgedAt");

-- Step 3: Add assignedToId to Delegation
ALTER TABLE "delegations"
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;

CREATE INDEX IF NOT EXISTS "delegations_assignedToId_idx" ON "delegations"("assignedToId");

ALTER TABLE "delegations"
  ADD CONSTRAINT "delegations_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 4: Create notification_preferences table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "eventType" "NotificationType" NOT NULL,
  "inApp"     BOOLEAN      NOT NULL DEFAULT true,
  "push"      BOOLEAN      NOT NULL DEFAULT true,
  "email"     BOOLEAN      NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_userId_eventType_key"
  ON "notification_preferences"("userId", "eventType");

CREATE INDEX IF NOT EXISTS "notification_preferences_userId_idx"
  ON "notification_preferences"("userId");

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
