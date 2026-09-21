-- Ngày viết đơn: giữ NGUYÊN VĂN chữ cán bộ gõ, trên cả ba thực thể
--
-- Đo prod 21/09/2026 (bản sao 47.169 đơn thư): 46.129 hồ sơ mang chữ ngày viết đơn từ hệ cũ,
-- 41.675 đọc ra được một ngày, 4.454 thì KHÔNG. Mẫu điển hình là hồ sơ GỘP nhiều đơn —
-- "19/4/2021 (03 đơn), 20/4/2021 (9 đơn), 21/4/2021, …" — hoặc ghi chú "Không ghi ngày".
--
-- Trước hôm nay dạng ấy chỉ tồn tại được qua di trú (bản gốc cất trong `legacyRaw`); form
-- KHÔNG nhập nổi, nên hệ đọc được thứ nó không cho phép tạo ra.
--
-- `ngay_viet_don_chu` là TEXT không giới hạn: chuỗi dài nhất đo được trên prod vượt 200 ký tự,
-- và cột EDTF là VARCHAR(10) nên không nhét vào đó được.
--
-- Vụ việc và Vụ án nhận THÊM cả cột EDTF: trước đó hai màn ấy chỉ có cột ngày trơn, nên ngày
-- thiếu thành phần (`../../2026`) mất hẳn khi nhập — hỏng nặng hơn Đơn thư chứ không nhẹ hơn.
--
-- Chỉ THÊM cột, không đụng dữ liệu sẵn có. Không cần nạp lại gì.

ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "ngay_viet_don_chu" TEXT;

ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "ngay_viet_don_edtf" VARCHAR(10);
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "ngay_viet_don_chu" TEXT;

ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "ngay_viet_don_edtf" VARCHAR(10);
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "ngay_viet_don_chu" TEXT;
