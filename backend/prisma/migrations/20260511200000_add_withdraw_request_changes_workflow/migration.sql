-- Withdraw / Request-Changes workflow for deadline rule versioning.
--
-- Adds:
--   1. `withdrawNotes` column on deadline_rule_versions — separate from `reviewNotes`
--      (which belongs to reviewer's decision). withdrawNotes is proposer's own reason.
--   2. Two new NotificationType enum values to feed proposer/approver alerts when
--      the maker withdraws or the checker requests-changes.
--
-- No data migration: existing rows get NULL for withdrawNotes, which is correct
-- (nothing has been withdrawn yet).

ALTER TABLE "deadline_rule_versions" ADD COLUMN "withdrawNotes" TEXT;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEADLINE_RULE_WITHDRAWN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEADLINE_RULE_CHANGES_REQUESTED';
