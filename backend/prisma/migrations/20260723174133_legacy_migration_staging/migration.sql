-- Di trú dữ liệu hệ thống cũ: bảng chờ + sổ chạy + alias đơn vị + bảng lỗi + chẩn đoán trường.
-- Không đụng bảng vận hành nào. Xem khối chú thích cuối schema.prisma.

-- CreateTable
CREATE TABLE "legacy_staging" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "rowHash" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_import_runs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "sourceChecksums" JSONB NOT NULL DEFAULT '{}',
    "legacyKeyVersion" TEXT NOT NULL DEFAULT 'v2-collection-prefixed',
    "lastBatchNo" INTEGER NOT NULL DEFAULT 0,
    "counts" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,

    CONSTRAINT "legacy_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_unit_aliases" (
    "id" TEXT NOT NULL,
    "rawValue" TEXT NOT NULL,
    "sampleRaw" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "teamId" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legacy_unit_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_import_errors" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_field_diagnostics" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "parsed" TEXT,
    "precision" TEXT,
    "reason" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_field_diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legacy_staging_runId_idx" ON "legacy_staging"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_staging_sourceFile_sourceId_key" ON "legacy_staging"("sourceFile", "sourceId");

-- CreateIndex
CREATE INDEX "legacy_import_runs_status_idx" ON "legacy_import_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_unit_aliases_rawValue_key" ON "legacy_unit_aliases"("rawValue");

-- CreateIndex
CREATE INDEX "legacy_unit_aliases_kind_idx" ON "legacy_unit_aliases"("kind");

-- CreateIndex
CREATE INDEX "legacy_import_errors_runId_reason_idx" ON "legacy_import_errors"("runId", "reason");

-- CreateIndex
CREATE INDEX "legacy_field_diagnostics_runId_field_idx" ON "legacy_field_diagnostics"("runId", "field");
