-- Report criteria per team, foundation. Only new nullable columns and two enums: nothing existing changes meaning.
-- NULL everywhere means "as before": a field with no item key, a target and an assignment that own every field.

CREATE TYPE "DynReportCriterionOrigin" AS ENUM ('FILE', 'MANUAL');
CREATE TYPE "DynReportVersionSource" AS ENUM ('TEMPLATE', 'CRITERIA');

ALTER TABLE "dyn_report_fields"
  ADD COLUMN "itemKey" TEXT,
  ADD COLUMN "unit" TEXT,
  ADD COLUMN "parentItemKey" TEXT,
  ADD COLUMN "origin" "DynReportCriterionOrigin";

ALTER TABLE "dyn_report_versions"
  ADD COLUMN "sourceKind" "DynReportVersionSource" NOT NULL DEFAULT 'TEMPLATE',
  ADD COLUMN "sourceFileBytes" BYTEA,
  ADD COLUMN "sourceFileName" TEXT,
  ADD COLUMN "sourceSelection" JSONB;

ALTER TABLE "dyn_report_targets" ADD COLUMN "itemKeys" JSONB;

ALTER TABLE "dyn_report_assignments" ADD COLUMN "ownedFieldKeys" JSONB;
