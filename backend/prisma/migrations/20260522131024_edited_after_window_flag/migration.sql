-- v0.36.0.0 (v0.35c): Phase 5-lite edit window warning flag
-- Per Phase 5-lite design: audit-only flag, not enforcement. Records edited
-- AFTER the per-team window (Team.editWindowHours or SystemSetting fallback)
-- get marked editedAfterWindow=true. Admin can query later to evaluate evidence
-- before v0.37 hard-block decision.

ALTER TABLE "cases"     ADD COLUMN "editedAfterWindow" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "incidents" ADD COLUMN "editedAfterWindow" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "petitions" ADD COLUMN "editedAfterWindow" BOOLEAN NOT NULL DEFAULT false;

-- Partial indexes — only records flagged are indexed (saves space on PC02 records)
CREATE INDEX "cases_editedAfterWindow_idx"     ON "cases"("editedAfterWindow")     WHERE "editedAfterWindow" = true;
CREATE INDEX "incidents_editedAfterWindow_idx" ON "incidents"("editedAfterWindow") WHERE "editedAfterWindow" = true;
CREATE INDEX "petitions_editedAfterWindow_idx" ON "petitions"("editedAfterWindow") WHERE "editedAfterWindow" = true;
