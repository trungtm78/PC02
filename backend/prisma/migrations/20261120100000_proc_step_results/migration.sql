-- Results of a step: what the unit that works it reports (what was done, what was found, what is proposed), and what the
-- people around it say (the head of the unit, the units that coordinate or check, the leader who approves). New tables
-- and enums only; nothing existing is rewritten.

-- CreateEnum
CREATE TYPE "ProcReportKind" AS ENUM ('PROGRESS', 'RESULT');

-- CreateEnum
CREATE TYPE "ProcOpinionKind" AS ENUM ('SUPERVISOR', 'COORDINATE', 'CHECK', 'APPROVAL');

-- CreateEnum
CREATE TYPE "ProcOpinionVerdict" AS ENUM ('NOTE', 'PASS', 'REQUEST_REWORK', 'AGREE', 'DISAGREE', 'OTHER_DIRECTION');

-- CreateTable
CREATE TABLE "proc_step_reports" (
    "id" TEXT NOT NULL,
    "recordStepId" TEXT NOT NULL,
    "recordKind" "ProcRecordKind" NOT NULL,
    "recordId" TEXT NOT NULL,
    "kind" "ProcReportKind" NOT NULL,
    "doneWork" TEXT NOT NULL,
    "findings" TEXT,
    "difficulties" TEXT,
    "proposalKind" TEXT,
    "proposalContent" TEXT,
    "proposalBasis" TEXT,
    "documents" JSONB,
    "authorId" TEXT NOT NULL,
    "authorTeamId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "withdrawnAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proc_step_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proc_step_opinions" (
    "id" TEXT NOT NULL,
    "recordStepId" TEXT NOT NULL,
    "recordKind" "ProcRecordKind" NOT NULL,
    "recordId" TEXT NOT NULL,
    "kind" "ProcOpinionKind" NOT NULL,
    "verdict" "ProcOpinionVerdict" NOT NULL,
    "content" TEXT,
    "reportId" TEXT,
    "reportRevision" INTEGER,
    "authorId" TEXT NOT NULL,
    "authorTeamId" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proc_step_opinions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proc_step_reports_recordStepId_createdAt_idx" ON "proc_step_reports"("recordStepId", "createdAt");

-- CreateIndex
CREATE INDEX "proc_step_reports_recordKind_recordId_idx" ON "proc_step_reports"("recordKind", "recordId");

-- CreateIndex
CREATE INDEX "proc_step_opinions_recordStepId_createdAt_idx" ON "proc_step_opinions"("recordStepId", "createdAt");

-- CreateIndex
CREATE INDEX "proc_step_opinions_reportId_idx" ON "proc_step_opinions"("reportId");

-- AddForeignKey
ALTER TABLE "proc_step_reports" ADD CONSTRAINT "proc_step_reports_recordStepId_fkey" FOREIGN KEY ("recordStepId") REFERENCES "proc_record_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proc_step_opinions" ADD CONSTRAINT "proc_step_opinions_recordStepId_fkey" FOREIGN KEY ("recordStepId") REFERENCES "proc_record_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proc_step_opinions" ADD CONSTRAINT "proc_step_opinions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "proc_step_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An opinion about a result names the revision of the report it was given on.
ALTER TABLE "proc_step_opinions" ADD CONSTRAINT "proc_step_opinions_report_revision_together"
    CHECK (("reportId" IS NULL) = ("reportRevision" IS NULL));
