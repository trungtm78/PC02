-- Merging one team into another keeps a manifest of every record it touched, so the merge can be undone.

CREATE TYPE "TeamMergeStatus" AS ENUM ('APPLIED', 'UNDONE');

CREATE TABLE "team_merge_operations" (
    "id" TEXT NOT NULL,
    "sourceTeamId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "targetTeamId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "status" "TeamMergeStatus" NOT NULL DEFAULT 'APPLIED',
    "sourcePreviousStatus" "TeamStatus" NOT NULL,
    "mergedById" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneById" TEXT,
    "undoneAt" TIMESTAMP(3),
    "summary" JSONB NOT NULL,

    CONSTRAINT "team_merge_operations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_merge_items" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordKey" JSONB NOT NULL,
    "before" JSONB,
    "after" JSONB,

    CONSTRAINT "team_merge_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "team_merge_operations_sourceTeamId_idx" ON "team_merge_operations"("sourceTeamId");
CREATE INDEX "team_merge_operations_targetTeamId_idx" ON "team_merge_operations"("targetTeamId");
CREATE INDEX "team_merge_operations_mergedAt_idx" ON "team_merge_operations"("mergedAt");
CREATE INDEX "team_merge_items_operationId_tableName_idx" ON "team_merge_items"("operationId", "tableName");

ALTER TABLE "team_merge_items" ADD CONSTRAINT "team_merge_items_operationId_fkey"
  FOREIGN KEY ("operationId") REFERENCES "team_merge_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
