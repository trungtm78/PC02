-- PR1 ListPageShell — composite index cho /cases/stats hot path.
--
-- /cases/stats được hit trên mỗi search change từ CaseListPageShell (và sẽ
-- là tất cả ListPageShell consumers ở PR2-PR5). Hot path query shape:
--
--   SELECT status, COUNT(*) FROM "Case"
--   WHERE "deletedAt" IS NULL AND "caseType" = 'REGULAR'
--   GROUP BY status;
--
-- Hiện tại schema chỉ có single-column index @@index([status]),
-- @@index([deletedAt]), @@index([caseType]). PG planner chọn 1 index, heap-
-- filter rest → HashAggregate trên filtered set. Ở 100k+ rows, query time
-- scale linearly.
--
-- Composite index (deletedAt, caseType, status) covers groupBy index-only
-- scan + partial WHERE filter. Cũng speedup getList (cùng base predicate).
--
-- Memory `project_v040_ship.md`: CONCURRENTLY failed twice trong Prisma
-- migrations — dùng plain CREATE INDEX. Acceptable vì Case table chưa lớn
-- và operation block read tối đa vài giây.

CREATE INDEX "Case_deletedAt_caseType_status_idx"
ON "Case" ("deletedAt", "caseType", "status")
WHERE "deletedAt" IS NULL;
