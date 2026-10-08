-- 09/10/2026 — "Giờ tiếp nhận" của Đơn thư (HH:mm, giờ Việt Nam). NULL = không biết giờ.
--
-- Cột riêng, KHÔNG nhét giờ vào "receivedDate": ngày ấy lưu 00:00 UTC nên ~47.000 hồ sơ cũ sẽ thành "07:00" giả trên Giấy biên nhận.
-- Thêm cột nullable không ghi lại bảng và không khoá dài: an toàn khi chạy lúc deploy. Không có dữ liệu cũ để điền —
-- hồ sơ cũ để NULL và bản in giữ khung trống.
ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "gioTiepNhan" VARCHAR(5);

-- Định dạng 24 giờ chặt: "09:30" mới hợp lệ; "9:30", "24:00", "09:60", "09:30:00" đều bị từ chối ở TẦNG CSDL, không chỉ ở DTO.
ALTER TABLE "petitions" DROP CONSTRAINT IF EXISTS "petitions_gioTiepNhan_dinh_dang_chk";
ALTER TABLE "petitions"
  ADD CONSTRAINT "petitions_gioTiepNhan_dinh_dang_chk"
  CHECK ("gioTiepNhan" IS NULL OR "gioTiepNhan" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
