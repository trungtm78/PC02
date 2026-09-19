-- Danh sách mặc định sắp theo NGÀY ĐỀ XUẤT giảm dần (anh yêu cầu 19/09/2026), cùng ngày thì STT
-- giảm dần, rồi `id`. Truy vấn phát ra:
--     ORDER BY "ngayDeXuat" DESC NULLS LAST, "sttSort" DESC NULLS LAST, "id" DESC
-- (Vụ án thêm điều kiện `case_type` đứng đầu, như mọi truy vấn danh sách vụ án.)
--
-- Chỉ mục phải khớp ĐÚNG thứ tự và chiều ấy — kể cả `NULLS LAST` (xem ghi chú đo PG18 ở migration
-- 20260824120000_list_sort_by_receipt_date: thiếu hai chữ này thì Postgres sắp lại toàn bảng).
--
-- CREATE INDEX thường, KHÔNG CONCURRENTLY: Prisma chạy migration trong giao dịch (đã trả giá ở v0.40).
-- Bảng lớn nhất ~47 nghìn hàng, khoá ghi trong khoảng dưới một giây.
--
-- Đơn thư trước đây KHÔNG có chỉ mục nào trên `ngayDeXuat`.
CREATE INDEX IF NOT EXISTS "petitions_ngayDeXuat_sttSort_id_idx"
  ON "petitions" ("ngayDeXuat" DESC NULLS LAST, "sttSort" DESC NULLS LAST, "id" DESC)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "incidents_ngayDeXuat_sttSort_id_idx"
  ON "incidents" ("ngayDeXuat" DESC NULLS LAST, "sttSort" DESC NULLS LAST, "id" DESC)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "cases_caseType_ngayDeXuat_sttSort_id_idx"
  ON "cases" ("case_type", "ngayDeXuat" DESC NULLS LAST, "sttSort" DESC NULLS LAST, "id" DESC)
  WHERE "deletedAt" IS NULL;

-- KHÔNG xoá hai chỉ mục cũ (ngayDeXuat, id) của Vụ việc/Vụ án: vẫn còn truy vấn sắp đúng
-- `ngayDeXuat DESC, id DESC` không có STT ở giữa (workflow.service.ts), mà chỉ mục mới chỉ phục vụ
-- nó bằng sắp bổ sung. Hai bảng vài nghìn hàng, chi phí ghi thêm không đáng kể.
