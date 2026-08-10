
-- CreateTable
CREATE TABLE "report_export_logs" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "fileName" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "errorText" TEXT,
    "exportedById" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_export_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_export_logs_reportType_createdAt_idx" ON "report_export_logs"("reportType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "report_export_logs_exportedById_idx" ON "report_export_logs"("exportedById");

-- AddForeignKey
ALTER TABLE "report_export_logs" ADD CONSTRAINT "report_export_logs_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

