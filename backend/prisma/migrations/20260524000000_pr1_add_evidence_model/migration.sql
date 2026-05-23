-- PR 1 v0.38.0.0 — Add Evidence model (Vật chứng)
-- Fix bug data-loss wizard "Khởi tố vụ án mới":
-- Subjects/Evidences/Documents được create đồng bộ với Case trong cùng transaction.
-- Schema additive — không phá data Case cũ.

-- CreateTable
CREATE TABLE "evidences" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'cái',
    "storageLocation" TEXT,
    "receivedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'THU_GIU',
    "evidenceType" TEXT,
    "entryOrder" TEXT,
    "warehouseReceipt" TEXT,
    "caseId" TEXT NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidences_caseId_idx" ON "evidences"("caseId");

-- CreateIndex
CREATE INDEX "evidences_status_idx" ON "evidences"("status");

-- CreateIndex
CREATE INDEX "evidences_deletedAt_idx" ON "evidences"("deletedAt");

-- AddForeignKey
CREATE TABLE IF NOT EXISTS _evidences_fk_marker (id INT);  -- noop guard
DROP TABLE _evidences_fk_marker;

ALTER TABLE "evidences" ADD CONSTRAINT "evidences_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "cases"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
