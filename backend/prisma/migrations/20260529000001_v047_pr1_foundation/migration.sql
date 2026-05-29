-- AlterTable
ALTER TABLE "users" ADD COLUMN     "rank" TEXT;

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "importLogId" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "importedById" TEXT,
ADD COLUMN     "importedFrom" TEXT,
ADD COLUMN     "sourceFile" TEXT,
ADD COLUMN     "tdcKhacPhucBienBan" TEXT,
ADD COLUMN     "tdcKhacPhucLyDoBienPhap" TEXT;

-- AlterTable
ALTER TABLE "petitions" ADD COLUMN     "baoCaoBanGiamDoc" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCuPhapLy" TEXT,
ADD COLUMN     "deXuat" TEXT,
ADD COLUMN     "huongDanKhoiKien" TEXT,
ADD COLUMN     "lyDoChuyen" TEXT,
ADD COLUMN     "lyDoTraDon" TEXT,
ADD COLUMN     "nguonDon" TEXT,
ADD COLUMN     "nhanThay" TEXT,
ADD COLUMN     "petitionDate" TIMESTAMP(3),
ADD COLUMN     "raSoatTrung" TEXT,
ADD COLUMN     "subTeamAssigned" TEXT;

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "importLogId" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "importedById" TEXT,
ADD COLUMN     "importedFrom" TEXT,
ADD COLUMN     "sourceFile" TEXT,
ADD COLUMN     "tdcKhacPhucBienBan" TEXT,
ADD COLUMN     "tdcKhacPhucLyDoBienPhap" TEXT;

-- CreateTable
CREATE TABLE "document_render_logs" (
    "id" TEXT NOT NULL,
    "petitionId" TEXT,
    "caseId" TEXT,
    "incidentId" TEXT,
    "documentType" TEXT NOT NULL,
    "templateSha" TEXT NOT NULL,
    "renderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renderedById" TEXT NOT NULL,
    "generatedNumber" TEXT,
    "fileSha" TEXT,

    CONSTRAINT "document_render_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phu_luc_report_logs" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "unitCode" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileSha" TEXT NOT NULL,

    CONSTRAINT "phu_luc_report_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xlsx_import_logs" (
    "id" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileSha" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unitCodeDetected" TEXT,
    "succeededRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "conflictedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PARSED',
    "errorDetail" JSONB,
    "firstConfirmById" TEXT,
    "firstConfirmAt" TIMESTAMP(3),
    "secondConfirmById" TEXT,
    "secondConfirmAt" TIMESTAMP(3),
    "rolledBackById" TEXT,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "xlsx_import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xlsx_import_staging" (
    "id" TEXT NOT NULL,
    "importLogId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "detectedType" TEXT,
    "conflictReason" TEXT,

    CONSTRAINT "xlsx_import_staging_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_render_logs_petitionId_documentType_renderedAt_idx" ON "document_render_logs"("petitionId", "documentType", "renderedAt" DESC);

-- CreateIndex
CREATE INDEX "document_render_logs_caseId_documentType_idx" ON "document_render_logs"("caseId", "documentType");

-- CreateIndex
CREATE INDEX "document_render_logs_incidentId_documentType_idx" ON "document_render_logs"("incidentId", "documentType");

-- CreateIndex
CREATE INDEX "document_render_logs_renderedById_idx" ON "document_render_logs"("renderedById");

-- CreateIndex
CREATE INDEX "phu_luc_report_logs_reportType_periodStart_idx" ON "phu_luc_report_logs"("reportType", "periodStart");

-- CreateIndex
CREATE INDEX "phu_luc_report_logs_unitCode_idx" ON "phu_luc_report_logs"("unitCode");

-- CreateIndex
CREATE INDEX "phu_luc_report_logs_generatedById_idx" ON "phu_luc_report_logs"("generatedById");

-- CreateIndex
CREATE UNIQUE INDEX "xlsx_import_logs_fileSha_key" ON "xlsx_import_logs"("fileSha");

-- CreateIndex
CREATE INDEX "xlsx_import_logs_status_idx" ON "xlsx_import_logs"("status");

-- CreateIndex
CREATE INDEX "xlsx_import_logs_uploadedById_idx" ON "xlsx_import_logs"("uploadedById");

-- CreateIndex
CREATE INDEX "xlsx_import_logs_uploadedAt_idx" ON "xlsx_import_logs"("uploadedAt");

-- CreateIndex
CREATE INDEX "xlsx_import_staging_importLogId_sheetName_idx" ON "xlsx_import_staging"("importLogId", "sheetName");

-- CreateIndex
CREATE INDEX "xlsx_import_staging_conflictReason_idx" ON "xlsx_import_staging"("conflictReason");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES "xlsx_import_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES "xlsx_import_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_render_logs" ADD CONSTRAINT "document_render_logs_petitionId_fkey" FOREIGN KEY ("petitionId") REFERENCES "petitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_render_logs" ADD CONSTRAINT "document_render_logs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_render_logs" ADD CONSTRAINT "document_render_logs_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_render_logs" ADD CONSTRAINT "document_render_logs_renderedById_fkey" FOREIGN KEY ("renderedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phu_luc_report_logs" ADD CONSTRAINT "phu_luc_report_logs_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xlsx_import_logs" ADD CONSTRAINT "xlsx_import_logs_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xlsx_import_logs" ADD CONSTRAINT "xlsx_import_logs_firstConfirmById_fkey" FOREIGN KEY ("firstConfirmById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xlsx_import_logs" ADD CONSTRAINT "xlsx_import_logs_secondConfirmById_fkey" FOREIGN KEY ("secondConfirmById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xlsx_import_logs" ADD CONSTRAINT "xlsx_import_logs_rolledBackById_fkey" FOREIGN KEY ("rolledBackById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xlsx_import_staging" ADD CONSTRAINT "xlsx_import_staging_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES "xlsx_import_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
