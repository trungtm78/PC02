-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileBytes" BYTEA NOT NULL,
    "fileSha" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "needsNumber" BOOLEAN NOT NULL DEFAULT false,
    "numberSeriesId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_entityType_code_key" ON "document_templates"("entityType", "code");

-- CreateIndex
CREATE INDEX "document_templates_entityType_status_idx" ON "document_templates"("entityType", "status");

-- CreateIndex
CREATE INDEX "document_templates_category_idx" ON "document_templates"("category");
