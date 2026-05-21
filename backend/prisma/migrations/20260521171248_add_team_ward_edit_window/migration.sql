-- v0.33.0.0: Hybrid ward scoping (Option B) + Phase 5-lite edit window
-- Reuses Team hierarchy thay vì add separate User.assignedWardId.
-- Plan: ~/.claude/plans/ang-ph-t-sinh-l-i-tidy-curry.md (v7)

-- ── Team: ward link + editWindowHours override ────────────────────────────
ALTER TABLE "teams" ADD COLUMN "wardId" TEXT;
ALTER TABLE "teams" ADD COLUMN "editWindowHours" INTEGER;

-- FK to directories(type=WARD) — NOT VALID for online migration
ALTER TABLE "teams" ADD CONSTRAINT "teams_wardId_fkey"
  FOREIGN KEY ("wardId") REFERENCES "directories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "teams" VALIDATE CONSTRAINT "teams_wardId_fkey";

-- Plain CREATE INDEX (codex flagged). Acceptable vì teams table < 100 rows hiện tại.
-- TODO WARD-006: nếu teams table grow > 10k, refactor CONCURRENTLY trong separate deploy.
CREATE INDEX "teams_wardId_idx" ON "teams"("wardId");

-- ── EditWindowResetRequest (Phase 5b) ────────────────────────────────────
CREATE TABLE "edit_window_reset_requests" (
  "id" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,         -- 'Case' | 'Incident' | 'Petition'
  "subjectId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
  "reviewedById" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "edit_window_reset_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "edit_window_reset_requests" ADD CONSTRAINT "ewrr_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "edit_window_reset_requests" ADD CONSTRAINT "ewrr_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ewrr_status_idx" ON "edit_window_reset_requests"("status");
CREATE INDEX "ewrr_subject_idx" ON "edit_window_reset_requests"("subjectType", "subjectId");

-- CODEX CRIT 2: partial unique index — anti-spam dedupe
-- Mỗi user CHỈ 1 PENDING request per subject tại 1 thời điểm.
CREATE UNIQUE INDEX "ewrr_unique_pending" ON "edit_window_reset_requests"
  ("subjectType", "subjectId", "requestedById")
  WHERE "status" = 'PENDING';
