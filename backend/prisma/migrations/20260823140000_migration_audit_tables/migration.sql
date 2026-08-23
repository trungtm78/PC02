-- BUG-004 (UAT epic hợp nhất field, 2026-08-23):
-- PLAN-B3 yêu cầu xung đột và giá trị bị từ chối phải GHI LẠI ĐƯỢC để rà soát.
-- Công cụ chuẩn hoá trước đây chỉ xuất ra một tệp JSON tạm — chạy xong là mất dấu,
-- nên không ai truy được hồ sơ nào bị bỏ qua và vì lý do gì.
-- Chuyển thành bảng bền vững trong CSDL.

CREATE TABLE IF NOT EXISTS "migration_conflict" (
  "id"         TEXT PRIMARY KEY,
  "runId"      TEXT NOT NULL,
  "entity"     TEXT NOT NULL DEFAULT 'Case',
  "recordId"   TEXT NOT NULL,
  "field"      TEXT NOT NULL,
  "colValue"   TEXT,
  "metaValue"  TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "migration_conflict_runId_idx"    ON "migration_conflict" ("runId");
CREATE INDEX IF NOT EXISTS "migration_conflict_recordId_idx" ON "migration_conflict" ("recordId");
CREATE INDEX IF NOT EXISTS "migration_conflict_field_idx"    ON "migration_conflict" ("field");

CREATE TABLE IF NOT EXISTS "migration_reject" (
  "id"         TEXT PRIMARY KEY,
  "runId"      TEXT NOT NULL,
  "entity"     TEXT NOT NULL DEFAULT 'Case',
  "recordId"   TEXT NOT NULL,
  "field"      TEXT NOT NULL,
  "rawValue"   TEXT,
  "reason"     TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "migration_reject_runId_idx"    ON "migration_reject" ("runId");
CREATE INDEX IF NOT EXISTS "migration_reject_recordId_idx" ON "migration_reject" ("recordId");
CREATE INDEX IF NOT EXISTS "migration_reject_reason_idx"   ON "migration_reject" ("reason");
