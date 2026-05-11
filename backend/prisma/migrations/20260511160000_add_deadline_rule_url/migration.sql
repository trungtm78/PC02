-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1: add documentUrl column to deadline_rule_versions.
--
-- Purpose: store URL link to the official source (vbpl.vn, chinhphu.vn, ...)
-- so VKS audit and admin can click through to live source. Optional column;
-- validated on write at DTO (class-validator @IsUrl) + service (URL parse +
-- private-host rejection) layers.
--
-- Phase 2 (deferred) will introduce file upload UI for attachments. The
-- attachmentId column already exists in this table from migration
-- 20260511120000_deadline_rule_versioning — no schema change needed for v2.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "deadline_rule_versions"
  ADD COLUMN IF NOT EXISTS "documentUrl" TEXT;
