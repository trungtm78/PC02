-- Reminders about the steps of a record (switch `processing_flow_reminders`, OFF).
--
-- One row = one reminder for one person: the mark that it was decided ("dedupeKey", UNIQUE) and the work "deliver it"
-- in the same row, so the mark and the work can never be written apart. The key is
--   step + deadline revision + band (or escalation level) + recipient [+ the civil day in Vietnam for OVERDUE]
-- No foreign key to the step: a reminder never stops a flow from being replaced.
--
-- A new table only; nothing existing changes. Plain CREATE INDEX (never CONCURRENTLY inside a migration).

CREATE TABLE "proc_reminders" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "recordStepId" TEXT NOT NULL,
    "recordKind" "ProcRecordKind" NOT NULL,
    "recordId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "band" TEXT,
    "deadlineRevision" INTEGER NOT NULL,
    "recipientId" TEXT NOT NULL,
    "payload" JSONB,
    "status" "ProcOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "proc_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proc_reminders_dedupeKey_key" ON "proc_reminders"("dedupeKey");
CREATE INDEX "proc_reminders_status_availableAt_idx" ON "proc_reminders"("status", "availableAt");
CREATE INDEX "proc_reminders_recordStepId_idx" ON "proc_reminders"("recordStepId");
CREATE INDEX "proc_reminders_recordKind_recordId_idx" ON "proc_reminders"("recordKind", "recordId");
