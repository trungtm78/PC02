-- BUG-003 (UAT epic hợp nhất field, 2026-08-23):
-- PLAN-B4 yêu cầu tra cứu được theo các cột đã thăng và "thêm index cho cột hay lọc
-- (reporter name, cccd, sttCu, noiXayRa)". Bổ sung chỉ mục cho 3 cột mới đưa vào
-- điều kiện tìm kiếm. Dùng CREATE INDEX thường (không CONCURRENTLY) — Prisma chạy
-- migration trong transaction.
CREATE INDEX IF NOT EXISTS "cases_tenCungCap_idx"   ON "cases" ("tenCungCap");
CREATE INDEX IF NOT EXISTS "cases_cccdCungCap_idx"  ON "cases" ("cccdCungCap");
CREATE INDEX IF NOT EXISTS "cases_noiXayRa_idx"     ON "cases" ("noiXayRa");
