-- CreateEnum
CREATE TYPE "DynReportStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DynReportReportingUnit" AS ENUM ('TEAM', 'USER');

-- CreateEnum
CREATE TYPE "DynReportVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "DynReportFieldType" AS ENUM ('NUM', 'TEXT', 'DATE', 'TIME');

-- CreateEnum
CREATE TYPE "DynReportAggregateType" AS ENUM ('SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'NONE');

-- CreateEnum
CREATE TYPE "DynReportBlankPolicy" AS ENUM ('ZERO', 'IGNORE');

-- CreateEnum
CREATE TYPE "DynReportFieldSource" AS ENUM ('TOKEN', 'WEB');

-- CreateEnum
CREATE TYPE "DynReportRuleOperator" AS ENUM ('EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'COMPULSORY_PAIR', 'EXCLUSIVE_PAIR');

-- CreateEnum
CREATE TYPE "DynReportRuleSeverity" AS ENUM ('ERROR', 'WARNING');

-- CreateEnum
CREATE TYPE "DynReportRuleOrigin" AS ENUM ('MANUAL', 'SUGGESTED_FROM_IF');

-- CreateEnum
CREATE TYPE "DynReportPeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "DynReportRoleType" AS ENUM ('MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "DynReportPeriodStatus" AS ENUM ('OPEN', 'FINALIZED');

-- CreateEnum
CREATE TYPE "DynReportObligation" AS ENUM ('REQUIRED', 'EXEMPT');

-- CreateEnum
CREATE TYPE "DynReportSubmissionState" AS ENUM ('NOT_STARTED', 'DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED');

-- CreateEnum
CREATE TYPE "DynReportRevisionKind" AS ENUM ('SAVE', 'IMPORT', 'SUBMIT', 'RETURN', 'APPROVE', 'UNAPPROVE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "DynReportUnlockKind" AS ENUM ('GRANT', 'REQUEST');

-- CreateEnum
CREATE TYPE "DynReportUnlockStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DynReportAggregateMode" AS ENUM ('SUBMITTED', 'APPROVED', 'ALL_SAVED');

-- CreateEnum
CREATE TYPE "DynReportExportKind" AS ENUM ('TEAM', 'MANAGER_FULL', 'STATUS_LIST');

-- CreateEnum
CREATE TYPE "DynReportExportStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DYN_REPORT_RETURNED';
ALTER TYPE "NotificationType" ADD VALUE 'DYN_REPORT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'DYN_REPORT_UNLOCK_GRANTED';
ALTER TYPE "NotificationType" ADD VALUE 'DYN_REPORT_UNLOCK_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'DYN_REPORT_PERIOD_FINALIZED';
ALTER TYPE "NotificationType" ADD VALUE 'DYN_REPORT_DEADLINE_REMINDER';

-- CreateTable
CREATE TABLE "dyn_reports" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "DynReportStatus" NOT NULL DEFAULT 'DRAFT',
    "reportingUnit" "DynReportReportingUnit" NOT NULL DEFAULT 'TEAM',
    "effectiveFrom" TIMESTAMP(3),
    "configVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dyn_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_versions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DynReportVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "fileBytes" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "selectedSheets" JSONB NOT NULL,
    "layout" JSONB NOT NULL,
    "dateSystem" TEXT NOT NULL DEFAULT '1900',
    "parserVersion" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "issues" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_fields" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sheetKey" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "DynReportFieldType" NOT NULL,
    "format" TEXT,
    "aggregate" "DynReportAggregateType" NOT NULL DEFAULT 'NONE',
    "blankPolicy" "DynReportBlankPolicy" NOT NULL DEFAULT 'ZERO',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "min" DECIMAL(18,4),
    "max" DECIMAL(18,4),
    "scale" INTEGER,
    "maxLength" INTEGER,
    "helpText" TEXT,
    "source" "DynReportFieldSource" NOT NULL DEFAULT 'TOKEN',

    CONSTRAINT "dyn_report_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_validation_rules" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leftExpr" TEXT NOT NULL,
    "operator" "DynReportRuleOperator" NOT NULL,
    "rightExpr" TEXT NOT NULL,
    "severity" "DynReportRuleSeverity" NOT NULL DEFAULT 'ERROR',
    "message" TEXT NOT NULL,
    "missingStrategy" TEXT,
    "origin" "DynReportRuleOrigin" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "dyn_report_validation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_schedules" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "periodType" "DynReportPeriodType" NOT NULL,
    "periodStartDay" INTEGER,
    "dueRule" JSONB NOT NULL,
    "openRule" JSONB NOT NULL,
    "shiftNonWorking" BOOLEAN NOT NULL DEFAULT false,
    "oneTimeDate" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_roles" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "DynReportRoleType" NOT NULL,
    "teamScopeId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "dyn_report_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_targets" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "dyn_report_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_target_editors" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "dyn_report_target_editors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_periods" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "versionId" TEXT NOT NULL,
    "scheduleSnapshot" JSONB NOT NULL,
    "status" "DynReportPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_assignments" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamSnapshot" JSONB NOT NULL,
    "obligation" "DynReportObligation" NOT NULL DEFAULT 'REQUIRED',
    "exemptReason" TEXT,
    "exemptById" TEXT,
    "exemptAt" TIMESTAMP(3),
    "addedMidPeriodReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_assignment_editors" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "replacedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "replaceReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_assignment_editors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_submissions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "state" "DynReportSubmissionState" NOT NULL DEFAULT 'NOT_STARTED',
    "currentRevision" BIGINT NOT NULL DEFAULT 0,
    "values" JSONB NOT NULL DEFAULT '{}',
    "approvalLevel" INTEGER NOT NULL DEFAULT 0,
    "firstSavedAt" TIMESTAMP(3),
    "firstSubmittedAt" TIMESTAMP(3),
    "firstSubmittedRevision" BIGINT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "returnedReason" TEXT,
    "returnDueAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dyn_report_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_revisions" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "revision" BIGINT NOT NULL,
    "kind" "DynReportRevisionKind" NOT NULL,
    "valuesFull" JSONB,
    "diff" JSONB,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "committedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_unlocks" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "kind" "DynReportUnlockKind" NOT NULL,
    "status" "DynReportUnlockStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "bulkBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_comments" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "fieldKey" TEXT,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_snapshots" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "mode" "DynReportAggregateMode" NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceRevisions" JSONB NOT NULL,
    "contributorSetHash" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "invalidatedAt" TIMESTAMP(3),
    "invalidatedReason" TEXT,
    "official" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_exports" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "kind" "DynReportExportKind" NOT NULL,
    "scope" JSONB NOT NULL,
    "snapshotId" TEXT,
    "status" "DynReportExportStatus" NOT NULL DEFAULT 'PENDING',
    "fileBytes" BYTEA,
    "fileName" TEXT,
    "contributorSetHash" TEXT,
    "error" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dyn_report_idempotency_records" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resultRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dyn_reports_code_key" ON "dyn_reports"("code");

-- CreateIndex
CREATE INDEX "dyn_reports_status_idx" ON "dyn_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "dyn_report_versions_reportId_version_key" ON "dyn_report_versions"("reportId", "version");

-- CreateIndex
CREATE INDEX "dyn_report_fields_versionId_fieldKey_idx" ON "dyn_report_fields"("versionId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "dyn_report_fields_versionId_sheetKey_address_key" ON "dyn_report_fields"("versionId", "sheetKey", "address");

-- CreateIndex
CREATE INDEX "dyn_report_validation_rules_versionId_idx" ON "dyn_report_validation_rules"("versionId");

-- CreateIndex
CREATE INDEX "dyn_report_schedules_reportId_effectiveFrom_idx" ON "dyn_report_schedules"("reportId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "dyn_report_roles_reportId_userId_idx" ON "dyn_report_roles"("reportId", "userId");

-- CreateIndex
CREATE INDEX "dyn_report_roles_reportId_role_idx" ON "dyn_report_roles"("reportId", "role");

-- CreateIndex
CREATE INDEX "dyn_report_targets_reportId_teamId_idx" ON "dyn_report_targets"("reportId", "teamId");

-- CreateIndex
CREATE INDEX "dyn_report_target_editors_targetId_userId_idx" ON "dyn_report_target_editors"("targetId", "userId");

-- CreateIndex
CREATE INDEX "dyn_report_periods_status_dueAt_idx" ON "dyn_report_periods"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "dyn_report_periods_reportId_periodKey_key" ON "dyn_report_periods"("reportId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "dyn_report_assignments_periodId_teamId_key" ON "dyn_report_assignments"("periodId", "teamId");

-- CreateIndex
CREATE INDEX "dyn_report_assignment_editors_assignmentId_userId_idx" ON "dyn_report_assignment_editors"("assignmentId", "userId");

-- CreateIndex
CREATE INDEX "dyn_report_assignment_editors_assignmentId_isActive_idx" ON "dyn_report_assignment_editors"("assignmentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "dyn_report_submissions_assignmentId_key" ON "dyn_report_submissions"("assignmentId");

-- CreateIndex
CREATE INDEX "dyn_report_submissions_state_submittedAt_idx" ON "dyn_report_submissions"("state", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "dyn_report_revisions_submissionId_revision_key" ON "dyn_report_revisions"("submissionId", "revision");

-- CreateIndex
CREATE INDEX "dyn_report_unlocks_assignmentId_status_expiresAt_idx" ON "dyn_report_unlocks"("assignmentId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "dyn_report_unlocks_bulkBatchId_idx" ON "dyn_report_unlocks"("bulkBatchId");

-- CreateIndex
CREATE INDEX "dyn_report_comments_assignmentId_fieldKey_idx" ON "dyn_report_comments"("assignmentId", "fieldKey");

-- CreateIndex
CREATE INDEX "dyn_report_snapshots_periodId_mode_sourceHash_idx" ON "dyn_report_snapshots"("periodId", "mode", "sourceHash");

-- CreateIndex
CREATE INDEX "dyn_report_exports_status_expiresAt_idx" ON "dyn_report_exports"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "dyn_report_idempotency_records_actorId_action_key_key" ON "dyn_report_idempotency_records"("actorId", "action", "key");

-- AddForeignKey
ALTER TABLE "dyn_reports" ADD CONSTRAINT "dyn_reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_versions" ADD CONSTRAINT "dyn_report_versions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "dyn_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_versions" ADD CONSTRAINT "dyn_report_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_fields" ADD CONSTRAINT "dyn_report_fields_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "dyn_report_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_validation_rules" ADD CONSTRAINT "dyn_report_validation_rules_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "dyn_report_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_schedules" ADD CONSTRAINT "dyn_report_schedules_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "dyn_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_roles" ADD CONSTRAINT "dyn_report_roles_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "dyn_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_roles" ADD CONSTRAINT "dyn_report_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_targets" ADD CONSTRAINT "dyn_report_targets_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "dyn_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_targets" ADD CONSTRAINT "dyn_report_targets_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_target_editors" ADD CONSTRAINT "dyn_report_target_editors_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "dyn_report_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_target_editors" ADD CONSTRAINT "dyn_report_target_editors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_periods" ADD CONSTRAINT "dyn_report_periods_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "dyn_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_periods" ADD CONSTRAINT "dyn_report_periods_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "dyn_report_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_periods" ADD CONSTRAINT "dyn_report_periods_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_assignments" ADD CONSTRAINT "dyn_report_assignments_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "dyn_report_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_assignments" ADD CONSTRAINT "dyn_report_assignments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_assignments" ADD CONSTRAINT "dyn_report_assignments_exemptById_fkey" FOREIGN KEY ("exemptById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_assignment_editors" ADD CONSTRAINT "dyn_report_assignment_editors_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "dyn_report_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_assignment_editors" ADD CONSTRAINT "dyn_report_assignment_editors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_assignment_editors" ADD CONSTRAINT "dyn_report_assignment_editors_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_submissions" ADD CONSTRAINT "dyn_report_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "dyn_report_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_submissions" ADD CONSTRAINT "dyn_report_submissions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_revisions" ADD CONSTRAINT "dyn_report_revisions_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "dyn_report_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_revisions" ADD CONSTRAINT "dyn_report_revisions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_unlocks" ADD CONSTRAINT "dyn_report_unlocks_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "dyn_report_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_unlocks" ADD CONSTRAINT "dyn_report_unlocks_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_unlocks" ADD CONSTRAINT "dyn_report_unlocks_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_unlocks" ADD CONSTRAINT "dyn_report_unlocks_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_comments" ADD CONSTRAINT "dyn_report_comments_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "dyn_report_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_comments" ADD CONSTRAINT "dyn_report_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_snapshots" ADD CONSTRAINT "dyn_report_snapshots_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "dyn_report_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_exports" ADD CONSTRAINT "dyn_report_exports_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dyn_report_exports" ADD CONSTRAINT "dyn_report_exports_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "dyn_report_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

