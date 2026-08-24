-- Sắp xếp danh sách mới→cũ theo NGÀY NHẬN (feat/list-sort-newest-first).
--
-- Hai việc, đều additive và idempotent:
--   1. Cột sinh `petitions.sortReceivedDate` — đẩy ngày phi lý xuống cuối danh sách.
--   2. Chỉ mục cho các trường vừa thành trường sắp mặc định.

-- ── 1. Ngày nhận dùng để SẮP XẾP (khác ngày nhận để HIỂN THỊ) ────────────────
--
-- Đo trên dữ liệu thật: 9/45.459 đơn thư có `receivedDate` phi thực tế — năm 3023,
-- 2925, 2205, 2203 và một hồ sơ năm 0225. Sắp giảm dần theo ngày nhận thì đúng 9 hồ
-- sơ rác này chiếm TRỌN màn hình đầu tiên của danh sách, tức chỗ cán bộ nhìn nhiều nhất.
--
-- Cột sinh trả NULL cho ngày ngoài khoảng hợp lý; kết hợp `ORDER BY ... DESC NULLS LAST`
-- thì chúng chìm xuống cuối. Cột `receivedDate` gốc KHÔNG bị đụng — vẫn hiển thị nguyên
-- giá trị để cán bộ thấy mà sửa. Không giấu dữ liệu, chỉ đổi thứ tự.
--
-- Vì sao dùng mốc cố định 1900–2100 chứ không phải `now()`: cột sinh của PostgreSQL
-- yêu cầu biểu thức BẤT BIẾN, mà `now()` thì không.
--
-- Ưu điểm so với sửa tay 9 hàng: hồ sơ nhập sai TRONG TƯƠNG LAI cũng tự chìm. Bộ kiểm
-- `IsRealDateString` (đợt trước) chặn ngày không tồn tại như 31/02, nhưng KHÔNG chặn
-- ngày có thật mà phi lý như 30/11/3023.
ALTER TABLE "petitions"
  ADD COLUMN IF NOT EXISTS "sortReceivedDate" TIMESTAMP(3)
  GENERATED ALWAYS AS (
    CASE
      WHEN "receivedDate" >= TIMESTAMP '1900-01-01 00:00:00'
       AND "receivedDate" <  TIMESTAMP '2100-01-01 00:00:00'
      THEN "receivedDate"
    END
  ) STORED;

-- ── 2. Chỉ mục cho các trường sắp mặc định ───────────────────────────────────
--
-- Dùng CREATE INDEX thường, KHÔNG dùng CONCURRENTLY: Prisma chạy migration trong một
-- giao dịch, mà CONCURRENTLY không chạy được trong giao dịch (đã trả giá ở v0.40).
--
-- Chỉ mục MỘT PHẦN `WHERE "deletedAt" IS NULL` theo đúng mẫu sẵn có của bảng `cases`
-- (migration 20260530000001): mọi truy vấn danh sách đều lọc điều kiện này, nên chỉ mục
-- một phần vừa nhỏ hơn vừa phục vụ đúng truy vấn.

-- ⚠️ PHẢI ghi rõ `NULLS LAST` trong chỉ mục.
-- Truy vấn danh sách phát ra `ORDER BY ... DESC NULLS LAST` (để hồ sơ không có ngày chìm
-- xuống cuối). PostgreSQL KHÔNG dùng được chỉ mục NULLS FIRST — mặc định của `DESC` —
-- cho một truy vấn NULLS LAST. Đã đo trên PG18, bảng 200.000 hàng:
--     chỉ mục "d" DESC            + ORDER BY d DESC NULLS LAST → Sort (quét toàn bảng)
--     chỉ mục "d" DESC NULLS LAST + cùng truy vấn              → Index Only Scan
-- Viết thiếu hai chữ này thì chỉ mục vô dụng, và còn vô hiệu hoá luôn chỉ mục sẵn có.

-- Đơn thư: trường sắp mặc định mới.
CREATE INDEX IF NOT EXISTS "petitions_sortReceivedDate_idx"
  ON "petitions" ("sortReceivedDate" DESC NULLS LAST, "id" DESC)
  WHERE "deletedAt" IS NULL;

-- Vụ án: `ngayDeXuat` thành trường sắp mặc định nhưng CHƯA có chỉ mục nào.
-- Cột `case_type` đứng ĐẦU vì mọi truy vấn danh sách vụ án đều lọc bằng nó
-- (`caseType: caseType ?? CaseType.REGULAR` — Vụ án thường và UTDT dùng chung bảng này),
-- theo đúng mẫu của chỉ mục một phần sẵn có ở migration 20260530000001.
CREATE INDEX IF NOT EXISTS "cases_caseType_ngayDeXuat_idx"
  ON "cases" ("case_type", "ngayDeXuat" DESC NULLS LAST, "id" DESC)
  WHERE "deletedAt" IS NULL;

-- Vụ việc: bổ sung dạng ghép + một phần. Chỉ mục đơn cột sẵn có
-- (`incidents_ngayDeXuat_idx`) là NULLS FIRST nên không phục vụ được truy vấn mới.
CREATE INDEX IF NOT EXISTS "incidents_ngayDeXuat_id_idx"
  ON "incidents" ("ngayDeXuat" DESC NULLS LAST, "id" DESC)
  WHERE "deletedAt" IS NULL;

-- ── Ghi chú: vì sao CHỈ Đơn thư có cột sinh ──────────────────────────────────
-- Đã đo trên dữ liệu thật ngày 2026-08-24:
--   petitions.receivedDate : 9 hồ sơ ngoài khoảng 1900–2100  → cần cột sinh
--   cases.ngayDeXuat       : 0 hồ sơ ngoài khoảng, 0 ngày tương lai
--   incidents.ngayDeXuat   : 0 hồ sơ ngoài khoảng, 0 ngày tương lai
-- Bất đối xứng này là CÓ CHỦ Ý theo số liệu, không phải bỏ sót. Nếu về sau Vụ án hoặc
-- Vụ việc xuất hiện ngày phi lý thì áp cùng khuôn: cột sinh + `fieldAliases`.
