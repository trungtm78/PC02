-- The log of a move of a team's people and records to another team that is not a merge
-- (src/authz/cli/ap-so-do-pc02.ts, src/authz/cli/team-record-move.ts). Team and user ids are plain text, as for merges.

-- CreateTable
CREATE TABLE "team_record_moves" (
    "id" TEXT NOT NULL,
    "sourceTeamId" TEXT NOT NULL,
    "targetTeamId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TeamMergeStatus" NOT NULL DEFAULT 'APPLIED',
    "movedById" TEXT NOT NULL,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneById" TEXT,
    "undoneAt" TIMESTAMP(3),
    "summary" JSONB NOT NULL,

    CONSTRAINT "team_record_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_record_move_items" (
    "id" TEXT NOT NULL,
    "moveId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordKey" JSONB NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,

    CONSTRAINT "team_record_move_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_record_moves_sourceTeamId_idx" ON "team_record_moves"("sourceTeamId");

-- CreateIndex
CREATE INDEX "team_record_moves_targetTeamId_idx" ON "team_record_moves"("targetTeamId");

-- CreateIndex
CREATE INDEX "team_record_move_items_moveId_tableName_idx" ON "team_record_move_items"("moveId", "tableName");

-- AddForeignKey
ALTER TABLE "team_record_move_items" ADD CONSTRAINT "team_record_move_items_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "team_record_moves"("id") ON DELETE CASCADE ON UPDATE CASCADE;
