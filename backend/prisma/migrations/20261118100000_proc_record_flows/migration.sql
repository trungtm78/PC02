-- A processing flow applied to a record: the flow it follows (pinned to one published version, with the reason it was
-- chosen), its steps with their stored deadlines, the units that work each step, the append-only history of changes,
-- the outbox that applies a flow after a record is saved, and the keys that make a retried write harmless. New tables
-- and enums only; nothing existing is rewritten, and no flow is applied to any record here.

-- CreateEnum
CREATE TYPE "ProcRecordFlowMatch" AS ENUM ('TYPE', 'GROUP', 'DEFAULT', 'UNKNOWN_TYPE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProcStepStatus" AS ENUM ('WAITING_ANCHOR', 'OPEN', 'REPORTED', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ProcOutboxStatus" AS ENUM ('PENDING', 'DONE', 'DEAD');

-- CreateTable
CREATE TABLE "proc_record_flows" (
    "id" TEXT NOT NULL,
    "recordKind" "ProcRecordKind" NOT NULL,
    "recordId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "match" "ProcRecordFlowMatch" NOT NULL,
    "directoryId" TEXT,
    "typeKey" TEXT,
    "bindingId" TEXT,
    "conditions" JSONB,
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "appliedById" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proc_record_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proc_record_steps" (
    "id" TEXT NOT NULL,
    "recordFlowId" TEXT NOT NULL,
    "recordKind" "ProcRecordKind" NOT NULL,
    "recordId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "ProcStepStatus" NOT NULL DEFAULT 'WAITING_ANCHOR',
    "skippedFrom" "ProcStepStatus",
    "startAt" TIMESTAMP(3),
    "regulatoryDueAt" TIMESTAMP(3),
    "internalDueAt" TIMESTAMP(3),
    "provisional" BOOLEAN NOT NULL DEFAULT false,
    "calendarVersion" TEXT,
    "greenFrom" TIMESTAMP(3),
    "yellowFrom" TIMESTAMP(3),
    "redFrom" TIMESTAMP(3),
    "variant" TEXT,
    "problem" TEXT,
    "deadlineRevision" INTEGER NOT NULL DEFAULT 1,
    "upstreamReopened" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proc_record_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proc_record_step_parties" (
    "id" TEXT NOT NULL,
    "recordStepId" TEXT NOT NULL,
    "partyKind" "ProcPartyKind" NOT NULL,
    "teamId" TEXT,
    "role" "ProcPartyRole" NOT NULL,
    "assigneeUserId" TEXT,
    "note" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "proc_record_step_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proc_step_changes" (
    "id" TEXT NOT NULL,
    "recordFlowId" TEXT NOT NULL,
    "recordKind" "ProcRecordKind" NOT NULL,
    "recordId" TEXT NOT NULL,
    "stepKey" TEXT,
    "action" TEXT NOT NULL,
    "fromValue" JSONB,
    "toValue" JSONB,
    "reason" TEXT,
    "actorId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proc_step_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proc_outbox" (
    "id" TEXT NOT NULL,
    "recordKind" "ProcRecordKind" NOT NULL,
    "recordId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ProcOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "proc_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proc_command_keys" (
    "key" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "recordKind" "ProcRecordKind" NOT NULL,
    "recordId" TEXT NOT NULL,
    "outcome" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proc_command_keys_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "proc_record_flows_flowId_idx" ON "proc_record_flows"("flowId");

-- CreateIndex
CREATE INDEX "proc_record_flows_versionId_idx" ON "proc_record_flows"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "proc_record_flows_recordKind_recordId_key" ON "proc_record_flows"("recordKind", "recordId");

-- CreateIndex
CREATE INDEX "proc_record_steps_recordKind_recordId_idx" ON "proc_record_steps"("recordKind", "recordId");

-- CreateIndex
CREATE INDEX "proc_record_steps_status_regulatoryDueAt_idx" ON "proc_record_steps"("status", "regulatoryDueAt");

-- CreateIndex
CREATE INDEX "proc_record_steps_status_redFrom_idx" ON "proc_record_steps"("status", "redFrom");

-- CreateIndex
CREATE INDEX "proc_record_steps_stepId_idx" ON "proc_record_steps"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "proc_record_steps_recordFlowId_stepKey_key" ON "proc_record_steps"("recordFlowId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "proc_record_steps_recordFlowId_order_key" ON "proc_record_steps"("recordFlowId", "order");

-- CreateIndex
CREATE INDEX "proc_record_step_parties_recordStepId_idx" ON "proc_record_step_parties"("recordStepId");

-- CreateIndex
CREATE INDEX "proc_record_step_parties_teamId_idx" ON "proc_record_step_parties"("teamId");

-- CreateIndex
CREATE INDEX "proc_step_changes_recordKind_recordId_at_idx" ON "proc_step_changes"("recordKind", "recordId", "at");

-- CreateIndex
CREATE INDEX "proc_step_changes_recordFlowId_at_idx" ON "proc_step_changes"("recordFlowId", "at");

-- CreateIndex
CREATE INDEX "proc_outbox_status_availableAt_idx" ON "proc_outbox"("status", "availableAt");

-- CreateIndex
CREATE INDEX "proc_outbox_recordKind_recordId_idx" ON "proc_outbox"("recordKind", "recordId");

-- CreateIndex
CREATE INDEX "proc_command_keys_createdAt_idx" ON "proc_command_keys"("createdAt");

-- AddForeignKey
ALTER TABLE "proc_record_flows" ADD CONSTRAINT "proc_record_flows_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "proc_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proc_record_flows" ADD CONSTRAINT "proc_record_flows_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "proc_flow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proc_record_steps" ADD CONSTRAINT "proc_record_steps_recordFlowId_fkey" FOREIGN KEY ("recordFlowId") REFERENCES "proc_record_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proc_record_steps" ADD CONSTRAINT "proc_record_steps_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "proc_flow_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proc_record_step_parties" ADD CONSTRAINT "proc_record_step_parties_recordStepId_fkey" FOREIGN KEY ("recordStepId") REFERENCES "proc_record_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proc_record_step_parties" ADD CONSTRAINT "proc_record_step_parties_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- At most one pending application of a flow per record: a second request while one waits is the same work.
CREATE UNIQUE INDEX "proc_outbox_one_pending_per_record" ON "proc_outbox"("recordKind", "recordId") WHERE "status" = 'PENDING';

-- The internal deadline of a step never goes past the regulatory one (the rule of the command layer, kept by the database).
ALTER TABLE "proc_record_steps" ADD CONSTRAINT "proc_record_steps_internal_within_regulatory"
    CHECK ("internalDueAt" IS NULL OR "regulatoryDueAt" IS NULL OR "internalDueAt" <= "regulatoryDueAt");

-- A step that is done carries the moment it was done; one that is not, does not.
ALTER TABLE "proc_record_steps" ADD CONSTRAINT "proc_record_steps_done_has_time"
    CHECK (("status" = 'DONE') = ("doneAt" IS NOT NULL));

-- A step skipped remembers where it came from; one that is not skipped does not.
ALTER TABLE "proc_record_steps" ADD CONSTRAINT "proc_record_steps_skipped_remembers"
    CHECK (("status" = 'SKIPPED') = ("skippedFrom" IS NOT NULL));
