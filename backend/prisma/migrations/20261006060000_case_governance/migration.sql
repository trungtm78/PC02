-- CreateEnum
CREATE TYPE "CaseIntakeStage" AS ENUM ('PHAN_LOAI', 'CHO_NHAN', 'DA_NHAN');

-- CreateEnum
CREATE TYPE "CaseInvestigationPhase" AS ENUM ('INITIAL', 'SUPPLEMENTARY', 'REINVESTIGATION', 'RESTORED');

-- CreateEnum
CREATE TYPE "CaseSensitivity" AS ENUM ('NORMAL', 'RESTRICTED');

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_caseId_fkey";

-- DropForeignKey
ALTER TABLE "evidences" DROP CONSTRAINT "evidences_caseId_fkey";

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "fieldDefinitionVersionId" TEXT,
ADD COLUMN     "governanceRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "governanceRuleVersionId" TEXT,
ADD COLUMN     "intakeStage" "CaseIntakeStage",
ADD COLUMN     "investigationPhase" "CaseInvestigationPhase",
ADD COLUMN     "sensitivity" "CaseSensitivity" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "case_governance_operations" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_governance_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_handoffs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromTeamId" TEXT,
    "toTeamId" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "priorIntakeStage" "CaseIntakeStage",
    "reason" TEXT,
    "resolutionReason" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_rule_versions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedHash" TEXT,
    "approvedRevision" INTEGER,
    "legalSources" JSONB NOT NULL,
    "sourceVerified" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_field_definition_versions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "approvedHash" TEXT,
    "approvedRevision" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_field_definition_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_action_requests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actionCode" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedRevision" INTEGER,
    "approvedHash" TEXT,
    "reviewNote" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_action_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_decisions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "issuer" TEXT NOT NULL,
    "signatory" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_relations" (
    "id" TEXT NOT NULL,
    "sourceCaseId" TEXT NOT NULL,
    "targetCaseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "decisionId" TEXT,
    "payload" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_governance_events" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_governance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_governance_tasks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sourceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_governance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_governance_outbox" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "event" JSONB NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "notificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_governance_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_governance_grants" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "granteeId" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_governance_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_asset_versions" (
    "retiredAt" TIMESTAMP(3),
    "dispositionId" TEXT,
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "parentVersionId" TEXT,
    "kind" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "documentUpdatedAt" TIMESTAMP(3) NOT NULL,
    "parentSha256" TEXT,
    "tool" TEXT,
    "toolVersion" TEXT,
    "sourceHash" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_asset_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_custody_events" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "assetVersionId" TEXT,
    "correctsEventId" TEXT,
    "actorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_custody_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_disclosure_packets" (
    "deltaOfPacketId" TEXT,
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientPolicy" JSONB,
    "purpose" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "contentHash" TEXT NOT NULL,
    "approvedRevision" INTEGER,
    "approvedHash" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_disclosure_packets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_disclosure_packet_items" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "assetVersionId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "redaction" JSONB,
    "lineage" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_disclosure_packet_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_evidence_holds" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "assetVersionId" TEXT,
    "reason" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,

    CONSTRAINT "case_evidence_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_representation_grants" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "lawyerId" TEXT NOT NULL,
    "subjectId" TEXT,
    "granteeId" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "case_representation_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_retention_policies" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "preserveUntil" TIMESTAMP(3) NOT NULL,
    "basis" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "reviewedById" TEXT,
    "approvedHash" TEXT,
    "approvedRevision" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_disposition_requests" (
    "executedById" TEXT,
    "executedAt" TIMESTAMP(3),
    "receipt" JSONB,
    "outcome" TEXT,
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "assetVersionIds" JSONB NOT NULL,
    "purpose" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "approvedHash" TEXT,
    "approvedRevision" INTEGER,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_disposition_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_governance_operations_actorId_caseId_operation_request_key" ON "case_governance_operations"("actorId", "caseId", "operation", "requestKey");

-- CreateIndex
CREATE INDEX "case_handoffs_caseId_state_idx" ON "case_handoffs"("caseId", "state");

-- CreateIndex
CREATE INDEX "case_handoffs_toTeamId_state_idx" ON "case_handoffs"("toTeamId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "case_rule_versions_code_revision_key" ON "case_rule_versions"("code", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "case_field_definition_versions_code_revision_key" ON "case_field_definition_versions"("code", "revision");

-- CreateIndex
CREATE INDEX "case_action_requests_caseId_status_idx" ON "case_action_requests"("caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "case_decisions_requestId_key" ON "case_decisions"("requestId");

-- CreateIndex
CREATE INDEX "case_decisions_caseId_idx" ON "case_decisions"("caseId");

-- CreateIndex
CREATE INDEX "case_relations_targetCaseId_idx" ON "case_relations"("targetCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "case_relations_sourceCaseId_targetCaseId_type_key" ON "case_relations"("sourceCaseId", "targetCaseId", "type");

-- CreateIndex
CREATE INDEX "case_governance_events_caseId_createdAt_idx" ON "case_governance_events"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "case_governance_tasks_status_dueAt_idx" ON "case_governance_tasks"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "case_governance_tasks_caseId_type_sourceId_key" ON "case_governance_tasks"("caseId", "type", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "case_governance_outbox_notificationId_key" ON "case_governance_outbox"("notificationId");

-- CreateIndex
CREATE INDEX "case_governance_outbox_status_nextAttemptAt_idx" ON "case_governance_outbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "case_governance_outbox_operationId_recipientId_key" ON "case_governance_outbox"("operationId", "recipientId");

-- CreateIndex
CREATE INDEX "case_governance_grants_caseId_granteeId_idx" ON "case_governance_grants"("caseId", "granteeId");

-- CreateIndex
CREATE UNIQUE INDEX "case_asset_versions_documentId_key" ON "case_asset_versions"("documentId");

-- CreateIndex
CREATE INDEX "case_asset_versions_caseId_idx" ON "case_asset_versions"("caseId");

-- CreateIndex
CREATE INDEX "case_custody_events_caseId_idx" ON "case_custody_events"("caseId");

-- CreateIndex
CREATE INDEX "case_disclosure_packets_caseId_status_idx" ON "case_disclosure_packets"("caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "case_disclosure_packet_items_packetId_assetVersionId_key" ON "case_disclosure_packet_items"("packetId", "assetVersionId");

-- CreateIndex
CREATE INDEX "case_evidence_holds_caseId_releasedAt_idx" ON "case_evidence_holds"("caseId", "releasedAt");

-- CreateIndex
CREATE INDEX "case_representation_grants_caseId_granteeId_idx" ON "case_representation_grants"("caseId", "granteeId");

-- CreateIndex
CREATE INDEX "case_retention_policies_caseId_status_idx" ON "case_retention_policies"("caseId", "status");

-- CreateIndex
CREATE INDEX "case_disposition_requests_caseId_status_idx" ON "case_disposition_requests"("caseId", "status");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_fieldDefinitionVersionId_fkey" FOREIGN KEY ("fieldDefinitionVersionId") REFERENCES "case_field_definition_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_governanceRuleVersionId_fkey" FOREIGN KEY ("governanceRuleVersionId") REFERENCES "case_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_operations" ADD CONSTRAINT "case_governance_operations_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_operations" ADD CONSTRAINT "case_governance_operations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_handoffs" ADD CONSTRAINT "case_handoffs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_handoffs" ADD CONSTRAINT "case_handoffs_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_handoffs" ADD CONSTRAINT "case_handoffs_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_handoffs" ADD CONSTRAINT "case_handoffs_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_handoffs" ADD CONSTRAINT "case_handoffs_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_rule_versions" ADD CONSTRAINT "case_rule_versions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_rule_versions" ADD CONSTRAINT "case_rule_versions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_field_definition_versions" ADD CONSTRAINT "case_field_definition_versions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_field_definition_versions" ADD CONSTRAINT "case_field_definition_versions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_action_requests" ADD CONSTRAINT "case_action_requests_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_action_requests" ADD CONSTRAINT "case_action_requests_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "case_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_action_requests" ADD CONSTRAINT "case_action_requests_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_action_requests" ADD CONSTRAINT "case_action_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_decisions" ADD CONSTRAINT "case_decisions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_decisions" ADD CONSTRAINT "case_decisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "case_action_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_decisions" ADD CONSTRAINT "case_decisions_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "case_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_decisions" ADD CONSTRAINT "case_decisions_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_decisions" ADD CONSTRAINT "case_decisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_relations" ADD CONSTRAINT "case_relations_sourceCaseId_fkey" FOREIGN KEY ("sourceCaseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_relations" ADD CONSTRAINT "case_relations_targetCaseId_fkey" FOREIGN KEY ("targetCaseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_relations" ADD CONSTRAINT "case_relations_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "case_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_relations" ADD CONSTRAINT "case_relations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_events" ADD CONSTRAINT "case_governance_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_events" ADD CONSTRAINT "case_governance_events_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "case_governance_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_events" ADD CONSTRAINT "case_governance_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_tasks" ADD CONSTRAINT "case_governance_tasks_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_tasks" ADD CONSTRAINT "case_governance_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_outbox" ADD CONSTRAINT "case_governance_outbox_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_outbox" ADD CONSTRAINT "case_governance_outbox_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "case_governance_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_outbox" ADD CONSTRAINT "case_governance_outbox_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_grants" ADD CONSTRAINT "case_governance_grants_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_grants" ADD CONSTRAINT "case_governance_grants_granteeId_fkey" FOREIGN KEY ("granteeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_governance_grants" ADD CONSTRAINT "case_governance_grants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_asset_versions" ADD CONSTRAINT "case_asset_versions_dispositionId_fkey" FOREIGN KEY ("dispositionId") REFERENCES "case_disposition_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_asset_versions" ADD CONSTRAINT "case_asset_versions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_asset_versions" ADD CONSTRAINT "case_asset_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_asset_versions" ADD CONSTRAINT "case_asset_versions_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "case_asset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_asset_versions" ADD CONSTRAINT "case_asset_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_custody_events" ADD CONSTRAINT "case_custody_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_custody_events" ADD CONSTRAINT "case_custody_events_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_custody_events" ADD CONSTRAINT "case_custody_events_assetVersionId_fkey" FOREIGN KEY ("assetVersionId") REFERENCES "case_asset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_custody_events" ADD CONSTRAINT "case_custody_events_correctsEventId_fkey" FOREIGN KEY ("correctsEventId") REFERENCES "case_custody_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_custody_events" ADD CONSTRAINT "case_custody_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disclosure_packets" ADD CONSTRAINT "case_disclosure_packets_deltaOfPacketId_fkey" FOREIGN KEY ("deltaOfPacketId") REFERENCES "case_disclosure_packets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disclosure_packets" ADD CONSTRAINT "case_disclosure_packets_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disclosure_packets" ADD CONSTRAINT "case_disclosure_packets_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disclosure_packets" ADD CONSTRAINT "case_disclosure_packets_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disclosure_packets" ADD CONSTRAINT "case_disclosure_packets_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disclosure_packet_items" ADD CONSTRAINT "case_disclosure_packet_items_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "case_disclosure_packets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disclosure_packet_items" ADD CONSTRAINT "case_disclosure_packet_items_assetVersionId_fkey" FOREIGN KEY ("assetVersionId") REFERENCES "case_asset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_evidence_holds" ADD CONSTRAINT "case_evidence_holds_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_evidence_holds" ADD CONSTRAINT "case_evidence_holds_assetVersionId_fkey" FOREIGN KEY ("assetVersionId") REFERENCES "case_asset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_evidence_holds" ADD CONSTRAINT "case_evidence_holds_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_evidence_holds" ADD CONSTRAINT "case_evidence_holds_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_representation_grants" ADD CONSTRAINT "case_representation_grants_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_representation_grants" ADD CONSTRAINT "case_representation_grants_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "lawyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_representation_grants" ADD CONSTRAINT "case_representation_grants_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_representation_grants" ADD CONSTRAINT "case_representation_grants_granteeId_fkey" FOREIGN KEY ("granteeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_representation_grants" ADD CONSTRAINT "case_representation_grants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_representation_grants" ADD CONSTRAINT "case_representation_grants_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_retention_policies" ADD CONSTRAINT "case_retention_policies_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_retention_policies" ADD CONSTRAINT "case_retention_policies_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_retention_policies" ADD CONSTRAINT "case_retention_policies_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disposition_requests" ADD CONSTRAINT "case_disposition_requests_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disposition_requests" ADD CONSTRAINT "case_disposition_requests_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disposition_requests" ADD CONSTRAINT "case_disposition_requests_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "case_retention_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disposition_requests" ADD CONSTRAINT "case_disposition_requests_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disposition_requests" ADD CONSTRAINT "case_disposition_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Governance invariants cannot be expressed by Prisma's schema DSL.
CREATE UNIQUE INDEX "case_handoffs_one_pending" ON "case_handoffs" ("caseId") WHERE state = 'PENDING';
ALTER TABLE "case_handoffs" ADD CONSTRAINT "case_handoffs_state_check" CHECK (state IN ('PENDING','ACCEPTED','CANCELLED','RETURNED'));
ALTER TABLE "case_relations" ADD CONSTRAINT "case_relations_not_self" CHECK ("sourceCaseId" <> "targetCaseId");
ALTER TABLE "case_governance_grants" ADD CONSTRAINT "case_grants_interval_check" CHECK ("expiresAt" IS NULL OR "expiresAt" > "startsAt");
INSERT INTO "feature_flags" (key,label,enabled,domain,"rolloutPct","createdAt","updatedAt") VALUES ('CASE_GOVERNANCE_V1','Case governance',false,'case-domain',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT (key) DO NOTHING;
