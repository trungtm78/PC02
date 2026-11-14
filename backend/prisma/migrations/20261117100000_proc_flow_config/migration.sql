-- The configuration of processing flows: a flow per record kind (petition, incident, case), what it is bound to (an
-- information type of the LOAI_THONG_TIN catalogue or, for petitions, a deadline group), its versions, and the steps of
-- each version with their parties and their variants. New tables, new enums and three feature switches only; nothing
-- existing is rewritten, and no flow is created here.

CREATE TYPE "ProcRecordKind" AS ENUM ('PETITION', 'INCIDENT', 'CASE');

CREATE TYPE "ProcFlowStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TYPE "ProcFlowVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

CREATE TYPE "ProcDurationUnit" AS ENUM ('HOUR', 'DAY', 'WORKING_DAY', 'MONTH');

CREATE TYPE "ProcAnchorKind" AS ENUM ('RECEIVED', 'PROPOSED', 'ASSIGNED_TO_UNIT', 'ACCEPTED', 'PROSECUTED', 'MINUTES_RECEIVED', 'PREVIOUS_STEP_DONE');

CREATE TYPE "ProcPartyKind" AS ENUM ('RECORD_TEAM', 'TEAM');

CREATE TYPE "ProcPartyRole" AS ENUM ('MAIN', 'CHECK', 'COORDINATE', 'INFORM');

CREATE TYPE "ProcConditionKey" AS ENUM ('CRIME_GRAVITY');

CREATE TABLE "proc_flows" (
    "id" TEXT NOT NULL,
    "recordKind" "ProcRecordKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProcFlowStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proc_flows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proc_flow_bindings" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "recordKind" "ProcRecordKind" NOT NULL,
    "directoryId" TEXT,
    "typeKey" TEXT,
    "deadlineGroup" "LoaiDon",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proc_flow_bindings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proc_flow_versions" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "status" "ProcFlowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proc_flow_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proc_flow_steps" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationValue" INTEGER NOT NULL,
    "durationUnit" "ProcDurationUnit" NOT NULL,
    "anchor" "ProcAnchorKind" NOT NULL,
    "rollToWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "redDays" INTEGER NOT NULL,
    "yellowDays" INTEGER NOT NULL,
    "greenDays" INTEGER NOT NULL,
    "legalBasis" TEXT,
    "legalDocNumber" TEXT,
    "legalDocUrl" TEXT,
    "legalVerifiedAt" TIMESTAMP(3),
    "legalVerifiedById" TEXT,
    "setsRecordDeadline" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "maxExtensions" INTEGER NOT NULL DEFAULT 0,
    "extensionValue" INTEGER,
    "extensionUnit" "ProcDurationUnit",
    "escalateAfterDays" INTEGER,
    "escalateLeadershipAfterDays" INTEGER,

    CONSTRAINT "proc_flow_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proc_flow_step_parties" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "partyKind" "ProcPartyKind" NOT NULL,
    "teamId" TEXT,
    "role" "ProcPartyRole" NOT NULL,
    "note" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "proc_flow_step_parties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proc_flow_step_variants" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "conditionKey" "ProcConditionKey" NOT NULL,
    "conditionValue" TEXT NOT NULL,
    "durationValue" INTEGER NOT NULL,
    "durationUnit" "ProcDurationUnit" NOT NULL,
    "maxExtensions" INTEGER,
    "extensionValue" INTEGER,
    "extensionUnit" "ProcDurationUnit",

    CONSTRAINT "proc_flow_step_variants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proc_flows_recordKind_status_idx" ON "proc_flows"("recordKind", "status");

CREATE INDEX "proc_flow_bindings_recordKind_directoryId_idx" ON "proc_flow_bindings"("recordKind", "directoryId");

CREATE INDEX "proc_flow_bindings_recordKind_typeKey_idx" ON "proc_flow_bindings"("recordKind", "typeKey");

CREATE INDEX "proc_flow_bindings_recordKind_deadlineGroup_idx" ON "proc_flow_bindings"("recordKind", "deadlineGroup");

CREATE UNIQUE INDEX "proc_flow_bindings_flowId_directoryId_key" ON "proc_flow_bindings"("flowId", "directoryId");

CREATE UNIQUE INDEX "proc_flow_bindings_flowId_deadlineGroup_key" ON "proc_flow_bindings"("flowId", "deadlineGroup");

CREATE INDEX "proc_flow_versions_flowId_status_idx" ON "proc_flow_versions"("flowId", "status");

CREATE UNIQUE INDEX "proc_flow_versions_flowId_versionNo_key" ON "proc_flow_versions"("flowId", "versionNo");

CREATE UNIQUE INDEX "proc_flow_steps_versionId_stepKey_key" ON "proc_flow_steps"("versionId", "stepKey");

CREATE UNIQUE INDEX "proc_flow_steps_versionId_order_key" ON "proc_flow_steps"("versionId", "order");

CREATE INDEX "proc_flow_step_parties_stepId_idx" ON "proc_flow_step_parties"("stepId");

CREATE INDEX "proc_flow_step_parties_teamId_idx" ON "proc_flow_step_parties"("teamId");

CREATE UNIQUE INDEX "proc_flow_step_variants_stepId_conditionKey_conditionValue_key" ON "proc_flow_step_variants"("stepId", "conditionKey", "conditionValue");

ALTER TABLE "proc_flow_bindings" ADD CONSTRAINT "proc_flow_bindings_flowId_fkey"
  FOREIGN KEY ("flowId") REFERENCES "proc_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proc_flow_bindings" ADD CONSTRAINT "proc_flow_bindings_directoryId_fkey"
  FOREIGN KEY ("directoryId") REFERENCES "directories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proc_flow_versions" ADD CONSTRAINT "proc_flow_versions_flowId_fkey"
  FOREIGN KEY ("flowId") REFERENCES "proc_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proc_flow_steps" ADD CONSTRAINT "proc_flow_steps_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "proc_flow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proc_flow_step_parties" ADD CONSTRAINT "proc_flow_step_parties_stepId_fkey"
  FOREIGN KEY ("stepId") REFERENCES "proc_flow_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proc_flow_step_parties" ADD CONSTRAINT "proc_flow_step_parties_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proc_flow_step_variants" ADD CONSTRAINT "proc_flow_step_variants_stepId_fkey"
  FOREIGN KEY ("stepId") REFERENCES "proc_flow_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Second line of defence for rules the service enforces under a lock (the schema built by `prisma db push` has neither
-- partial indexes nor check constraints, so the service never relies on these).

-- At most one default flow per record kind among the flows that are not archived.
CREATE UNIQUE INDEX "proc_flows_recordKind_default_active_key" ON "proc_flows"("recordKind")
  WHERE "isDefault" AND "status" = 'ACTIVE';

-- One name per record kind among the flows that are not archived.
CREATE UNIQUE INDEX "proc_flows_recordKind_name_active_key" ON "proc_flows"("recordKind", "name")
  WHERE "status" = 'ACTIVE';

-- A flow has at most one draft and at most one published version.
CREATE UNIQUE INDEX "proc_flow_versions_flowId_draft_key" ON "proc_flow_versions"("flowId")
  WHERE "status" = 'DRAFT';

CREATE UNIQUE INDEX "proc_flow_versions_flowId_published_key" ON "proc_flow_versions"("flowId")
  WHERE "status" = 'PUBLISHED';

-- A binding names an information type or a deadline group, never both and never neither.
ALTER TABLE "proc_flow_bindings" ADD CONSTRAINT "proc_flow_bindings_one_target"
  CHECK (("directoryId" IS NULL) <> ("deadlineGroup" IS NULL));

-- A named unit has its id; "the unit holding the record" has none.
ALTER TABLE "proc_flow_step_parties" ADD CONSTRAINT "proc_flow_step_parties_team_by_kind"
  CHECK (("partyKind" = 'TEAM') = ("teamId" IS NOT NULL));

-- The three switches of the feature, OFF until an administrator turns them on. A flag with no row would default to ON
-- (FeatureFlagsService.isEnabled is default-allow), so the rows are inserted explicitly.
--   processing_flow            the configuration screens and routes (flows, bindings, versions, the working calendar)
--   processing_flow_records    the steps and actions on each record (a later change)
--   processing_flow_reminders  the reminders and escalations by step (a later change)
INSERT INTO "feature_flags" ("key","label","description","enabled","domain","rolloutPct","updatedAt")
VALUES
  ('processing_flow','Quy trình & hạn xử lý','Thiết lập quy trình xử lý và thời hạn theo loại thông tin; lịch làm việc để tính hạn',FALSE,'workflow-domain',100,CURRENT_TIMESTAMP),
  ('processing_flow_records','Quy trình xử lý trên hồ sơ','Các bước xử lý, hạn từng bước và thao tác theo quy trình trên từng đơn thư, vụ việc, vụ án',FALSE,'workflow-domain',100,CURRENT_TIMESTAMP),
  ('processing_flow_reminders','Nhắc hạn theo quy trình','Nhắc hạn và báo cáo vượt cấp theo từng bước của quy trình xử lý',FALSE,'workflow-domain',100,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
