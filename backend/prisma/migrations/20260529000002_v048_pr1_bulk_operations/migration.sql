-- v0.48 PR1 B2: bulk operations audit infrastructure
-- 1 header row per bulk action (STARTED → COMPLETED|FAILED), N item rows in audit_logs.
-- Plan eng E-H3 (audit-inside-tx), E-H10 (idempotency key).

-- CreateEnum
CREATE TYPE "BulkOperationStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "bulk_operations" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "BulkOperationStatus" NOT NULL DEFAULT 'STARTED',
    "idempotencyKey" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "succeededCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bulk_operations_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN "bulkOperationId" TEXT;

-- CreateIndex (plain CREATE INDEX, not CONCURRENTLY — project_v040_ship lesson)
CREATE UNIQUE INDEX "bulk_operations_actorId_idempotencyKey_key" ON "bulk_operations"("actorId", "idempotencyKey");
CREATE INDEX "bulk_operations_actorId_startedAt_idx" ON "bulk_operations"("actorId", "startedAt" DESC);
CREATE INDEX "bulk_operations_resource_action_idx" ON "bulk_operations"("resource", "action");
CREATE INDEX "audit_logs_bulkOperationId_idx" ON "audit_logs"("bulkOperationId");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_bulkOperationId_fkey"
    FOREIGN KEY ("bulkOperationId") REFERENCES "bulk_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- ON DELETE SET NULL để giữ audit trail (match AuditLog.userId pattern, investigation system retention).
ALTER TABLE "bulk_operations" ADD CONSTRAINT "bulk_operations_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
