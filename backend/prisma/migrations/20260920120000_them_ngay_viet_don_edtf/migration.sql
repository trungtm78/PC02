-- "Ngày viết đơn" nhận được ngày THIẾU thành phần.
--
-- Giấy tờ nhiều khi chỉ ghi tháng/năm. Ô cũ là `<input type="date">` bắt buộc đủ ngày, nên cán
-- bộ đành để TRỐNG HẲN — mất luôn năm/tháng vốn đã biết.
--
-- Lưu theo EDTF Level 1 (ISO 8601-2, chuẩn Library of Congress cho ngày không đầy đủ):
--   2026-12-15 · 2026-12-XX · 2026-XX-XX
-- Chuỗi EDTF sắp xếp đúng thứ tự thời gian bằng so chuỗi, và lọc "tháng 12/2026" chạy thẳng
-- bằng LIKE '2026-12%' trên cả đơn nhập đủ lẫn nhập thiếu.
--
-- `petitionDate` GIỮ NGUYÊN: nhập đủ thì ghi cả hai (lọc/sắp xếp/in không đổi một dòng), nhập
-- thiếu thì để trống — KHÔNG BAO GIỜ bịa ngày 01.
ALTER TABLE "petitions" ADD COLUMN "ngay_viet_don_edtf" VARCHAR(10);

-- Bù dữ liệu đang có: mọi đơn đã có ngày đầy đủ thì cột mới mang đúng ngày ấy.
--
-- Vì sao cần: `ngayVietDonHienThi` ưu tiên cột EDTF. Không bù thì 47.456 hồ sơ cũ đi đường lùi
-- (đọc cột ngày thật) trong khi hồ sơ mới đi đường chính — hai đường, hai cách tính múi giờ,
-- và bất kỳ khác biệt nào cũng chỉ lộ ra trên bản in. Bù một lần là cả hai đi chung một đường.
--
-- `petitionDate` là TIMESTAMP(3) KHÔNG múi giờ, nên `to_char` không đổi ngày.
UPDATE "petitions"
SET "ngay_viet_don_edtf" = to_char("petitionDate", 'YYYY-MM-DD')
WHERE "petitionDate" IS NOT NULL;
