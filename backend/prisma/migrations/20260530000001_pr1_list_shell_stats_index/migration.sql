-- PR1 ListPageShell — composite index cho /cases/stats hot path.
--
-- /cases/stats được hit trên mỗi search change từ CaseListPageShell (và sẽ
-- là tất cả ListPageShell consumers ở PR2-PR5). Hot path query shape:
--
--   SELECT status, COUNT(*) FROM "cases"
--   WHERE "deletedAt" IS NULL AND "case_type" = 'REGULAR'
--   GROUP BY status;
--
-- Hiện tại schema chỉ có single-column index "cases_case_type_idx" + idx on
-- status, deletedAt riêng rẽ. PG planner chọn 1 index, heap-filter rest →
-- HashAggregate trên filtered set. Ở 100k+ rows, query time scale linearly.
--
-- Composite index (deletedAt, case_type, status) covers groupBy index-only
-- scan + partial WHERE filter. Cũng speedup getList (cùng base predicate).
--
-- Memory `project_v040_ship.md`: CONCURRENTLY failed twice trong Prisma
-- migrations — dùng plain CREATE INDEX. Acceptable vì cases table chưa lớn
-- và operation block read tối đa vài giây.
--
-- /codex review fix: table name = "cases" (via @@map), column "case_type"
-- (via @map("case_type")). Migration ban đầu dùng "Case" + "caseType"
-- (Prisma model + field names) → CREATE INDEX failed với relation not found.

CREATE INDEX "cases_deletedAt_case_type_status_idx"
ON "cases" ("deletedAt", "case_type", "status")
WHERE "deletedAt" IS NULL;
