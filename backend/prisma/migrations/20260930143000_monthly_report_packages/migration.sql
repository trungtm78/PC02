CREATE TYPE "monthly_report_status" AS ENUM ('DRAFT', 'NEEDS_VERIFICATION', 'REVIEWING', 'APPROVED', 'FINALIZED', 'REJECTED');

CREATE TABLE "monthly_report_packages" (
  "id" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "unitCode" TEXT,
  "scopeKey" TEXT NOT NULL,
  "unitName" TEXT NOT NULL,
  "teamIds" TEXT[] NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "lockVersion" INTEGER NOT NULL DEFAULT 0,
  "templateVersion" TEXT NOT NULL,
  "status" "monthly_report_status" NOT NULL DEFAULT 'DRAFT',
  "snapshot" JSONB NOT NULL,
  "checks" JSONB NOT NULL,
  "summary" JSONB NOT NULL,
  "detailWorkbook" BYTEA,
  "summaryWorkbook" BYTEA,
  "detailWorkbookSha256" TEXT,
  "summaryWorkbookSha256" TEXT,
  "parentId" TEXT,
  "createdById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "approvedById" TEXT,
  "finalizedById" TEXT,
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monthly_report_packages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monthly_report_contributions" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "appendix" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "cellKey" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityCode" TEXT,
  "label" TEXT NOT NULL,
  "eventAt" TIMESTAMP(3),
  "value" INTEGER NOT NULL,
  "ruleCode" TEXT NOT NULL,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_report_contributions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monthly_report_adjustments" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "appendix" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "issueCode" TEXT,
  "entityId" TEXT,
  "operation" TEXT NOT NULL,
  "previousValue" JSONB,
  "newValue" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_report_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_report_packages_periodStart_periodEnd_scopeKey_version_key" ON "monthly_report_packages"("periodStart", "periodEnd", "scopeKey", "version");
CREATE INDEX "monthly_report_packages_periodStart_periodEnd_status_idx" ON "monthly_report_packages"("periodStart", "periodEnd", "status");
CREATE INDEX "monthly_report_packages_createdById_idx" ON "monthly_report_packages"("createdById");
CREATE INDEX "monthly_report_contributions_reportId_appendix_metricKey_idx" ON "monthly_report_contributions"("reportId", "appendix", "metricKey");
CREATE INDEX "monthly_report_contributions_entityType_entityId_idx" ON "monthly_report_contributions"("entityType", "entityId");
CREATE INDEX "monthly_report_adjustments_reportId_appendix_targetKey_idx" ON "monthly_report_adjustments"("reportId", "appendix", "targetKey");

ALTER TABLE "monthly_report_packages" ADD CONSTRAINT "monthly_report_packages_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "monthly_report_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_report_contributions" ADD CONSTRAINT "monthly_report_contributions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "monthly_report_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monthly_report_adjustments" ADD CONSTRAINT "monthly_report_adjustments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "monthly_report_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
