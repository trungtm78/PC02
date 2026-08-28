-- Chữ viết tắt cán bộ TỰ ĐẶT, in ở dòng "Lưu:" cuối mọi chứng từ (hệ cũ: `thanh_vien.ten_ngan`).
--
-- Không suy ra được từ họ tên: đo 28/08/2026 trên 238 cán bộ, quy tắc "chữ đệm cuối + tên gọi"
-- chỉ đúng 11 người và sai 210 người (`Bùi Thanh Trà` → `Trà`, `Đội 5` → `Đ5`,
-- `Tổ Truy Nã` → `TRUYNA`). Quy ra 16.713/55.207 hồ sơ in sai dòng "Lưu:".
--
-- Nullable, và chuỗi RỖNG khác NULL: rỗng = cán bộ cố ý để trống (16 người, hệ cũ in trống),
-- NULL = chưa từng có (hệ cũ in họ tên đầy đủ). Gộp hai cái làm một là mất một nhánh.
ALTER TABLE "users" ADD COLUMN "shortName" TEXT;
