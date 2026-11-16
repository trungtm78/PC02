-- Ward assignment requests ("Hồ sơ phân công Công an cấp phường/xã"): a ward or commune police unit asks PC02 to
-- assign an investigator; PC02 reviews each submission. Additive only: new types, new tables, two nullable columns.
-- Every relation is RESTRICT: deleting a request removes its children first, in one transaction, in the service.

-- CreateEnum
CREATE TYPE "WardAssignmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED');

-- CreateEnum
CREATE TYPE "WardCaseType" AS ENUM ('INCIDENT', 'CASE');

-- CreateEnum
CREATE TYPE "WardAssignmentKind" AS ENUM ('NEW', 'REASSIGN');

-- CreateEnum
CREATE TYPE "WardRoundStatus" AS ENUM ('PENDING', 'WITHDRAWN', 'DECIDED');

-- CreateEnum
CREATE TYPE "WardDecisionKind" AS ENUM ('RETURN', 'APPROVE');

-- AlterTable
ALTER TABLE "document_render_logs" ADD COLUMN     "wardAssignmentId" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "wardAssignmentId" TEXT;

-- CreateTable
CREATE TABLE "ward_assignments" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "status" "WardAssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "assignedTeamId" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "enteredOnBehalf" BOOLEAN NOT NULL DEFAULT false,
    "caseType" "WardCaseType" NOT NULL,
    "kind" "WardAssignmentKind" NOT NULL DEFAULT 'NEW',
    "previousAssignmentId" TEXT,
    "reassignReason" TEXT,
    "crimeId" TEXT,
    "crimeOther" TEXT,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "discoveredOn" DATE,
    "place" TEXT,
    "subjectsUnknown" BOOLEAN NOT NULL DEFAULT false,
    "proposedInvestigatorId" TEXT,
    "entryOfficerName" TEXT NOT NULL,
    "entryOfficerPhone" TEXT,
    "unitNote" TEXT,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "assignedInvestigatorId" TEXT,
    "followUpUserId" TEXT,
    "followUpTeamId" TEXT,
    "pc02Note" TEXT,
    "receivedOn" DATE,
    "resultDueOn" DATE,
    "completedOn" DATE,
    "resultText" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ward_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_assignment_subjects" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "fullNameNorm" TEXT NOT NULL,
    "birthYear" INTEGER,
    "idNumber" TEXT,
    "idNumberNorm" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ward_assignment_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_assignment_rounds" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "submissionNo" INTEGER NOT NULL,
    "status" "WardRoundStatus" NOT NULL DEFAULT 'PENDING',
    "priorStatus" "WardAssignmentStatus" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnById" TEXT,

    CONSTRAINT "ward_assignment_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_assignment_decisions" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "kind" "WardDecisionKind" NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT NOT NULL,
    "reasonCode" TEXT,
    "reasonText" TEXT,
    "requirements" JSONB NOT NULL,
    "assignedInvestigatorId" TEXT,
    "followUpUserId" TEXT,
    "followUpTeamId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "slipYear" INTEGER,
    "slipNumber" TEXT,
    "slipIssuedAt" TIMESTAMP(3),
    "slipIssuedById" TEXT,
    "slipDocumentId" TEXT,
    "signers" JSONB,

    CONSTRAINT "ward_assignment_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_assignment_deadline_changes" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "oldDueOn" DATE,
    "newDueOn" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ward_assignment_deadline_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_investigators" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "rank" TEXT,
    "position" TEXT,
    "grade" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ward_investigators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ward_assignments_code_key" ON "ward_assignments"("code");

-- CreateIndex
CREATE INDEX "ward_assignments_assignedTeamId_status_idx" ON "ward_assignments"("assignedTeamId", "status");

-- CreateIndex
CREATE INDEX "ward_assignments_status_resultDueOn_idx" ON "ward_assignments"("status", "resultDueOn");

-- CreateIndex
CREATE INDEX "ward_assignments_enteredById_idx" ON "ward_assignments"("enteredById");

-- CreateIndex
CREATE INDEX "ward_assignments_submittedAt_idx" ON "ward_assignments"("submittedAt");

-- CreateIndex
CREATE INDEX "ward_assignment_subjects_idNumberNorm_idx" ON "ward_assignment_subjects"("idNumberNorm");

-- CreateIndex
CREATE INDEX "ward_assignment_subjects_fullNameNorm_birthYear_idx" ON "ward_assignment_subjects"("fullNameNorm", "birthYear");

-- CreateIndex
CREATE UNIQUE INDEX "ward_assignment_subjects_assignmentId_position_key" ON "ward_assignment_subjects"("assignmentId", "position");

-- CreateIndex
CREATE INDEX "ward_assignment_rounds_assignmentId_status_idx" ON "ward_assignment_rounds"("assignmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ward_assignment_rounds_assignmentId_sequence_key" ON "ward_assignment_rounds"("assignmentId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ward_assignment_decisions_slipDocumentId_key" ON "ward_assignment_decisions"("slipDocumentId");

-- CreateIndex
CREATE INDEX "ward_assignment_decisions_roundId_idx" ON "ward_assignment_decisions"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "ward_assignment_decisions_slipYear_slipNumber_key" ON "ward_assignment_decisions"("slipYear", "slipNumber");

-- CreateIndex
CREATE INDEX "ward_assignment_deadline_changes_assignmentId_idx" ON "ward_assignment_deadline_changes"("assignmentId");

-- CreateIndex
CREATE INDEX "ward_investigators_teamId_isActive_idx" ON "ward_investigators"("teamId", "isActive");

-- CreateIndex
CREATE INDEX "document_render_logs_wardAssignmentId_documentType_idx" ON "document_render_logs"("wardAssignmentId", "documentType");

-- CreateIndex
CREATE INDEX "documents_wardAssignmentId_idx" ON "documents"("wardAssignmentId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_wardAssignmentId_fkey" FOREIGN KEY ("wardAssignmentId") REFERENCES "ward_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_render_logs" ADD CONSTRAINT "document_render_logs_wardAssignmentId_fkey" FOREIGN KEY ("wardAssignmentId") REFERENCES "ward_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_previousAssignmentId_fkey" FOREIGN KEY ("previousAssignmentId") REFERENCES "ward_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "crimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_proposedInvestigatorId_fkey" FOREIGN KEY ("proposedInvestigatorId") REFERENCES "ward_investigators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_assignedInvestigatorId_fkey" FOREIGN KEY ("assignedInvestigatorId") REFERENCES "ward_investigators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_followUpUserId_fkey" FOREIGN KEY ("followUpUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_followUpTeamId_fkey" FOREIGN KEY ("followUpTeamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignments" ADD CONSTRAINT "ward_assignments_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_subjects" ADD CONSTRAINT "ward_assignment_subjects_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ward_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_rounds" ADD CONSTRAINT "ward_assignment_rounds_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ward_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_rounds" ADD CONSTRAINT "ward_assignment_rounds_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_rounds" ADD CONSTRAINT "ward_assignment_rounds_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_decisions" ADD CONSTRAINT "ward_assignment_decisions_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ward_assignment_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_decisions" ADD CONSTRAINT "ward_assignment_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_decisions" ADD CONSTRAINT "ward_assignment_decisions_assignedInvestigatorId_fkey" FOREIGN KEY ("assignedInvestigatorId") REFERENCES "ward_investigators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_decisions" ADD CONSTRAINT "ward_assignment_decisions_followUpUserId_fkey" FOREIGN KEY ("followUpUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_decisions" ADD CONSTRAINT "ward_assignment_decisions_followUpTeamId_fkey" FOREIGN KEY ("followUpTeamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_decisions" ADD CONSTRAINT "ward_assignment_decisions_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_decisions" ADD CONSTRAINT "ward_assignment_decisions_slipIssuedById_fkey" FOREIGN KEY ("slipIssuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_decisions" ADD CONSTRAINT "ward_assignment_decisions_slipDocumentId_fkey" FOREIGN KEY ("slipDocumentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_deadline_changes" ADD CONSTRAINT "ward_assignment_deadline_changes_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ward_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_assignment_deadline_changes" ADD CONSTRAINT "ward_assignment_deadline_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_investigators" ADD CONSTRAINT "ward_investigators_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_investigators" ADD CONSTRAINT "ward_investigators_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The switch of the feature, OFF until an administrator turns it on. A flag with no row reads as ON
-- (FeatureFlagsService.isEnabled is default-allow), so the row is inserted explicitly.
INSERT INTO "feature_flags" ("key","label","description","enabled","domain","rolloutPct","updatedAt")
VALUES ('ward-assignments','Hồ sơ phân công phường/xã','Công an cấp phường/xã trình hồ sơ xin phân công Điều tra viên; PC02 thẩm định, duyệt hoặc trả về, theo dõi hạn báo kết quả',FALSE,'case-domain',100,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
