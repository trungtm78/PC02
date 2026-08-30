-- Cột mốc GIẢI QUYẾT dùng chung cho cả ba thực thể.
--
-- Trước đây báo cáo "đã giải quyết" đếm theo `updatedAt` — lần chạm bản ghi gần nhất — nên mọi
-- kỳ đã qua đều ra 0. Đo trên máy thật 30/08/2026: `cases.ngay_tra_ket_qua` rỗng 0/3.381, và
-- incidents/petitions không có cột tương đương.
--
-- KHÔNG backfill ở đây. Hồ sơ đang ở trạng thái kết thúc mà chưa có mốc thì để RỖNG: gán
-- `updatedAt` hay `now()` là bịa đúng con số mà cả đợt này đi sửa.
--
-- CREATE INDEX thường, KHÔNG dùng CONCURRENTLY — Prisma chạy migration trong transaction.

ALTER TABLE "cases"     ADD COLUMN "ngay_giai_quyet" TIMESTAMP(3);
ALTER TABLE "incidents" ADD COLUMN "ngay_giai_quyet" TIMESTAMP(3);
ALTER TABLE "petitions" ADD COLUMN "ngay_giai_quyet" TIMESTAMP(3);

CREATE INDEX "cases_ngay_giai_quyet_idx"     ON "cases" ("ngay_giai_quyet");
CREATE INDEX "incidents_ngay_giai_quyet_idx" ON "incidents" ("ngay_giai_quyet");
CREATE INDEX "petitions_ngay_giai_quyet_idx" ON "petitions" ("ngay_giai_quyet");
