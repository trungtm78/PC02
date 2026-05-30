-- PR2 ListPageShell — composite indexes cho /incidents/stats + /petitions/stats hot path.
--
-- Mirror PR1 migration 20260530000001 cho Cases. Mỗi /stats được hit trên mỗi
-- search/filter change từ IncidentListPageShell + PetitionListPageShell (PR2).
-- Hot path query shape:
--
--   SELECT status, COUNT(*) FROM "incidents"
--   WHERE "deletedAt" IS NULL [AND ...other filters]
--   GROUP BY status;
--
--   SELECT status, COUNT(*) FROM "petitions"
--   WHERE "deletedAt" IS NULL [AND ...other filters]
--   GROUP BY status;
--
-- Hiện tại schema có single-column @@index([status]) + @@index([deletedAt])
-- riêng rẽ. PG planner chọn 1 index, heap-filter rest → HashAggregate trên
-- filtered set. Ở 50k+ rows / table, query time scale linearly.
--
-- Partial composite index (deletedAt, status) covers groupBy index-only scan
-- + partial WHERE filter. Cũng speedup getList (cùng base predicate).
--
-- Lessons applied:
-- - project_v040_ship.md: KHÔNG dùng CREATE INDEX CONCURRENTLY trong Prisma
--   migrations (đã fail 2x). Plain CREATE INDEX is OK — table chưa quá lớn,
--   block read tối đa vài giây.
-- - PR1 codex review: dùng table name từ @@map ("incidents", "petitions").
--   Column "status" + "deletedAt" không có @map → nguyên tên Prisma field.

CREATE INDEX "incidents_deletedAt_status_idx"
ON "incidents" ("deletedAt", "status")
WHERE "deletedAt" IS NULL;

CREATE INDEX "petitions_deletedAt_status_idx"
ON "petitions" ("deletedAt", "status")
WHERE "deletedAt" IS NULL;
