-- CreateEnum
CREATE TYPE "WardMatchSource" AS ENUM ('WARD_ASSIGNMENT', 'PETITION', 'INCIDENT', 'CASE');

-- CreateEnum
CREATE TYPE "WardReminderKind" AS ENUM ('SUBMITTED', 'RESUBMITTED', 'RETURNED', 'APPROVED', 'DUE_YELLOW', 'DUE_RED', 'OVERDUE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'WARD_ASSIGNMENT_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'WARD_ASSIGNMENT_RESUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'WARD_ASSIGNMENT_RETURNED';
ALTER TYPE "NotificationType" ADD VALUE 'WARD_ASSIGNMENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'WARD_ASSIGNMENT_DEADLINE_NEAR';
ALTER TYPE "NotificationType" ADD VALUE 'WARD_ASSIGNMENT_OVERDUE';

-- CreateTable
CREATE TABLE "ward_subject_match_conclusions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "subjectPosition" INTEGER NOT NULL,
    "otherSource" "WardMatchSource" NOT NULL,
    "otherRecordId" TEXT NOT NULL,
    "samePerson" BOOLEAN NOT NULL,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ward_subject_match_conclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_assignment_reminders" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "kind" "WardReminderKind" NOT NULL,
    "dueOn" DATE,
    "day" DATE,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ward_assignment_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ward_subject_match_conclusions_assignmentId_subjectPosition_key" ON "ward_subject_match_conclusions"("assignmentId", "subjectPosition", "otherSource", "otherRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ward_assignment_reminders_dedupeKey_key" ON "ward_assignment_reminders"("dedupeKey");

-- CreateIndex
CREATE INDEX "ward_assignment_reminders_assignmentId_idx" ON "ward_assignment_reminders"("assignmentId");
