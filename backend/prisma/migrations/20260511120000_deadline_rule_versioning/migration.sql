-- ─────────────────────────────────────────────────────────────────────────────
-- Deadline Rule Versioning — atomic migration
-- ─────────────────────────────────────────────────────────────────────────────
-- This migration introduces version-controlled legal deadline rules for the
-- 12 BLTTHS/Luật Tố cáo deadline keys. It:
--   1. Creates the deadline_rule_status enum + deadline_rule_versions table
--   2. Adds 5 new NotificationType enum values
--   3. Adds FK columns on incidents + petitions (snapshot at record creation)
--   4. Enforces invariants via partial unique indexes + CHECK
--   5. Seeds 12 initial active rule versions (proposedByType='SYSTEM')
--   6. Backfills all non-deleted Incident/Petition records to point at v1
--   7. REMOVES the 12 deadline keys from system_settings (eliminates silent
--      stale risk — SettingsService is no longer the source of truth)
--   8. Seeds DEADLINE_APPROVER role + write:/approve:DeadlineRuleVersion
--      permissions, granting both to ADMIN as well
-- All steps idempotent via NOT EXISTS / ON CONFLICT.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Enum + table ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "deadline_rule_status" AS ENUM ('draft', 'submitted', 'approved', 'active', 'superseded', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "deadline_rule_versions" (
  "id"                  TEXT PRIMARY KEY,
  "ruleKey"             TEXT NOT NULL,
  "value"               INTEGER NOT NULL,
  "label"               TEXT NOT NULL,
  "legalBasis"          TEXT NOT NULL,
  "documentType"        TEXT NOT NULL,
  "documentNumber"      TEXT NOT NULL,
  "documentIssuer"      TEXT NOT NULL,
  "documentDate"        TIMESTAMP(3),
  "attachmentId"        TEXT,
  "migrationConfidence" TEXT,
  "reason"              TEXT NOT NULL,
  "status"              "deadline_rule_status" NOT NULL DEFAULT 'draft',
  "effectiveFrom"       TIMESTAMP(3),
  "effectiveTo"         TIMESTAMP(3),
  "supersedesId"        TEXT,
  "proposedById"        TEXT,
  "proposedByType"      TEXT NOT NULL DEFAULT 'USER',
  "proposedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById"        TEXT,
  "reviewedAt"          TIMESTAMP(3),
  "reviewNotes"         TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deadline_rule_versions_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "deadline_rule_versions"("id") ON DELETE SET NULL,
  CONSTRAINT "deadline_rule_versions_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "deadline_rule_versions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "deadline_rule_versions_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "documents"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "deadline_rule_versions_ruleKey_status_idx" ON "deadline_rule_versions" ("ruleKey", "status");
CREATE INDEX IF NOT EXISTS "deadline_rule_versions_ruleKey_effectiveFrom_idx" ON "deadline_rule_versions" ("ruleKey", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "deadline_rule_versions_status_proposedAt_idx" ON "deadline_rule_versions" ("status", "proposedAt");
CREATE INDEX IF NOT EXISTS "deadline_rule_versions_attachmentId_idx" ON "deadline_rule_versions" ("attachmentId");

-- ── Partial unique indexes — DB-level invariants (one active/submitted/approved-pending per key) ──
CREATE UNIQUE INDEX IF NOT EXISTS "deadline_rule_one_active_per_key"
  ON "deadline_rule_versions" ("ruleKey") WHERE "status" = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS "deadline_rule_one_submitted_per_key"
  ON "deadline_rule_versions" ("ruleKey") WHERE "status" = 'submitted';
CREATE UNIQUE INDEX IF NOT EXISTS "deadline_rule_one_approved_pending_per_key"
  ON "deadline_rule_versions" ("ruleKey") WHERE "status" = 'approved';

-- ── CHECK: active implies effectiveFrom set ──
DO $$ BEGIN
  ALTER TABLE "deadline_rule_versions"
    ADD CONSTRAINT "deadline_rule_active_requires_effective_from"
    CHECK ("status" != 'active' OR "effectiveFrom" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. NotificationType enum extension ──────────────────────────────────────
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEADLINE_RULE_SUBMITTED'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEADLINE_RULE_APPROVED'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEADLINE_RULE_REJECTED'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEADLINE_RULE_ACTIVATED'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEADLINE_RULE_STALE_REVIEW'; EXCEPTION WHEN others THEN NULL; END $$;

-- ── 3. FK columns on Incident + Petition ────────────────────────────────────
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "deadlineRuleVersionId" TEXT;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "maxExtensionsSnapshot" INTEGER;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "giaHan1RuleVersionId" TEXT;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "giaHan2RuleVersionId" TEXT;

DO $$ BEGIN
  ALTER TABLE "incidents" ADD CONSTRAINT "incidents_deadlineRuleVersionId_fkey"
    FOREIGN KEY ("deadlineRuleVersionId") REFERENCES "deadline_rule_versions"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "incidents" ADD CONSTRAINT "incidents_giaHan1RuleVersionId_fkey"
    FOREIGN KEY ("giaHan1RuleVersionId") REFERENCES "deadline_rule_versions"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "incidents" ADD CONSTRAINT "incidents_giaHan2RuleVersionId_fkey"
    FOREIGN KEY ("giaHan2RuleVersionId") REFERENCES "deadline_rule_versions"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "incidents_deadlineRuleVersionId_idx" ON "incidents" ("deadlineRuleVersionId");
CREATE INDEX IF NOT EXISTS "incidents_giaHan1RuleVersionId_idx" ON "incidents" ("giaHan1RuleVersionId");
CREATE INDEX IF NOT EXISTS "incidents_giaHan2RuleVersionId_idx" ON "incidents" ("giaHan2RuleVersionId");

ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "deadlineRuleVersionId" TEXT;
DO $$ BEGIN
  ALTER TABLE "petitions" ADD CONSTRAINT "petitions_deadlineRuleVersionId_fkey"
    FOREIGN KEY ("deadlineRuleVersionId") REFERENCES "deadline_rule_versions"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "petitions_deadlineRuleVersionId_idx" ON "petitions" ("deadlineRuleVersionId");

-- ── 4. Seed 12 initial active rule versions (SYSTEM actor) ──────────────────
-- Deterministic IDs so backfill JOINs without lookup. Idempotent via NOT EXISTS.
INSERT INTO "deadline_rule_versions"
  ("id", "ruleKey", "value", "label", "legalBasis", "documentType", "documentNumber", "documentIssuer", "documentDate",
   "reason", "status", "effectiveFrom", "proposedByType", "proposedById", "migrationConfidence", "createdAt", "updatedAt")
SELECT
  'rule_init_' || ss."key" AS id,
  ss."key" AS "ruleKey",
  -- Parse value as integer; fall back to 0 if non-numeric (legacy data shouldn't exist for these keys)
  CASE WHEN ss."value" ~ '^\d+$' THEN CAST(ss."value" AS INTEGER) ELSE 0 END AS "value",
  ss."label",
  COALESCE(ss."legalBasis", 'Chưa rõ — cần bổ sung') AS "legalBasis",
  'Khác' AS "documentType",
  'INITIAL' AS "documentNumber",
  'BCA' AS "documentIssuer",
  NULL AS "documentDate",
  'Khởi tạo từ cấu hình hệ thống ban đầu — cần được admin bổ sung tài liệu chính thức' AS "reason",
  'active'::"deadline_rule_status" AS "status",
  ss."createdAt" AS "effectiveFrom",
  'SYSTEM' AS "proposedByType",
  NULL AS "proposedById",
  'legacy-default' AS "migrationConfidence",
  ss."createdAt" AS "createdAt",
  NOW() AS "updatedAt"
FROM "system_settings" ss
WHERE ss."key" IN (
  'THOI_HAN_XAC_MINH', 'THOI_HAN_GIA_HAN_1', 'THOI_HAN_GIA_HAN_2', 'THOI_HAN_TOI_DA',
  'THOI_HAN_PHUC_HOI', 'THOI_HAN_PHAN_LOAI', 'SO_LAN_GIA_HAN_TOI_DA', 'THOI_HAN_GUI_QD_VKS',
  'THOI_HAN_TO_CAO', 'THOI_HAN_KHIEU_NAI', 'THOI_HAN_KIEN_NGHI', 'THOI_HAN_PHAN_ANH'
)
AND NOT EXISTS (
  SELECT 1 FROM "deadline_rule_versions" drv WHERE drv."ruleKey" = ss."key"
);

-- ── 5. Backfill all non-deleted Incident records to v1 ──────────────────────
-- Pre-existing incidents had their `deadline` computed using settings live;
-- we anchor them to the initial active rule version so historical reconstruction
-- doesn't show NULL. Skip records that already have a snapshot.
UPDATE "incidents"
SET "deadlineRuleVersionId" = 'rule_init_THOI_HAN_XAC_MINH',
    "maxExtensionsSnapshot" = (
      SELECT "value" FROM "deadline_rule_versions" WHERE "id" = 'rule_init_SO_LAN_GIA_HAN_TOI_DA'
    )
WHERE "deletedAt" IS NULL
  AND "deadlineRuleVersionId" IS NULL
  AND EXISTS (SELECT 1 FROM "deadline_rule_versions" WHERE "id" = 'rule_init_THOI_HAN_XAC_MINH');

-- Backfill existing gia hạn 1 snapshots (incidents already gia hạn before migration)
UPDATE "incidents"
SET "giaHan1RuleVersionId" = 'rule_init_THOI_HAN_GIA_HAN_1'
WHERE "deletedAt" IS NULL
  AND "soLanGiaHan" >= 1
  AND "giaHan1RuleVersionId" IS NULL
  AND EXISTS (SELECT 1 FROM "deadline_rule_versions" WHERE "id" = 'rule_init_THOI_HAN_GIA_HAN_1');

UPDATE "incidents"
SET "giaHan2RuleVersionId" = 'rule_init_THOI_HAN_GIA_HAN_2'
WHERE "deletedAt" IS NULL
  AND "soLanGiaHan" >= 2
  AND "giaHan2RuleVersionId" IS NULL
  AND EXISTS (SELECT 1 FROM "deadline_rule_versions" WHERE "id" = 'rule_init_THOI_HAN_GIA_HAN_2');

-- ── 6. Backfill all non-deleted Petition records to v1 (per petitionType key mapping) ──
UPDATE "petitions"
SET "deadlineRuleVersionId" = CASE
  WHEN "petitionType"::TEXT = 'TO_CAO'    THEN 'rule_init_THOI_HAN_TO_CAO'
  WHEN "petitionType"::TEXT = 'KHIEU_NAI' THEN 'rule_init_THOI_HAN_KHIEU_NAI'
  WHEN "petitionType"::TEXT = 'KIEN_NGHI' THEN 'rule_init_THOI_HAN_KIEN_NGHI'
  WHEN "petitionType"::TEXT = 'PHAN_ANH'  THEN 'rule_init_THOI_HAN_PHAN_ANH'
  ELSE 'rule_init_THOI_HAN_PHAN_ANH'
END
WHERE "deletedAt" IS NULL
  AND "deadlineRuleVersionId" IS NULL;

-- ── 7. DELETE 12 deadline keys from system_settings (silent-stale defense) ──
-- After migration, SettingsService.getNumericValue() throws if called with these keys.
-- The runtime authority for these values is now `deadline_rule_versions`.
DELETE FROM "system_settings"
WHERE "key" IN (
  'THOI_HAN_XAC_MINH', 'THOI_HAN_GIA_HAN_1', 'THOI_HAN_GIA_HAN_2', 'THOI_HAN_TOI_DA',
  'THOI_HAN_PHUC_HOI', 'THOI_HAN_PHAN_LOAI', 'SO_LAN_GIA_HAN_TOI_DA', 'THOI_HAN_GUI_QD_VKS',
  'THOI_HAN_TO_CAO', 'THOI_HAN_KHIEU_NAI', 'THOI_HAN_KIEN_NGHI', 'THOI_HAN_PHAN_ANH'
);

-- ── 8. RBAC: permissions + DEADLINE_APPROVER role ───────────────────────────
INSERT INTO "permissions" ("id", "action", "subject", "description", "createdAt")
SELECT 'perm_drv_read', 'read', 'DeadlineRuleVersion', 'Xem quy tắc thời hạn xử lý', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "action" = 'read' AND "subject" = 'DeadlineRuleVersion');

INSERT INTO "permissions" ("id", "action", "subject", "description", "createdAt")
SELECT 'perm_drv_write', 'write', 'DeadlineRuleVersion', 'Đề xuất sửa quy tắc thời hạn (maker)', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "action" = 'write' AND "subject" = 'DeadlineRuleVersion');

INSERT INTO "permissions" ("id", "action", "subject", "description", "createdAt")
SELECT 'perm_drv_approve', 'approve', 'DeadlineRuleVersion', 'Duyệt và kích hoạt quy tắc thời hạn (checker)', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "action" = 'approve' AND "subject" = 'DeadlineRuleVersion');

INSERT INTO "roles" ("id", "name", "description", "createdAt", "updatedAt")
SELECT 'role_deadline_approver', 'DEADLINE_APPROVER', 'Người duyệt quy tắc thời hạn xử lý (legal compliance approver)', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'DEADLINE_APPROVER');

-- ADMIN gets all 3 perms (read + write + approve)
INSERT INTO "role_permissions" ("roleId", "permissionId", "assignedAt")
SELECT r."id", p."id", NOW()
FROM "roles" r, "permissions" p
WHERE r."name" = 'ADMIN'
  AND p."subject" = 'DeadlineRuleVersion'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- DEADLINE_APPROVER gets read + approve (NOT write — separation of duties; checker shouldn't propose)
INSERT INTO "role_permissions" ("roleId", "permissionId", "assignedAt")
SELECT r."id", p."id", NOW()
FROM "roles" r, "permissions" p
WHERE r."name" = 'DEADLINE_APPROVER'
  AND p."subject" = 'DeadlineRuleVersion'
  AND p."action" IN ('read', 'approve')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- OFFICER gets read only (so officers can see what rule applied to their cases)
INSERT INTO "role_permissions" ("roleId", "permissionId", "assignedAt")
SELECT r."id", p."id", NOW()
FROM "roles" r, "permissions" p
WHERE r."name" = 'OFFICER'
  AND p."subject" = 'DeadlineRuleVersion'
  AND p."action" = 'read'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
