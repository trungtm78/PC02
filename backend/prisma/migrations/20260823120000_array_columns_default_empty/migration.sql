-- BUG-001 (UAT epic hợp nhất field, 2026-08-23):
-- Cột mảng NOT NULL không có giá trị mặc định → mọi lệnh tạo bản ghi KHÔNG gửi
-- trường đó đều vỡ ràng buộc NOT NULL và trả lỗi máy chủ 500.
-- Vá theo LỚP LỖI: toàn bộ cột mảng NOT NULL trong lược đồ, không chỉ chỗ phát hiện.
-- Additive, idempotent, không đổi dữ liệu đang có.

ALTER TABLE "cases" ALTER COLUMN "lyDoTamDinhChiVuAn" SET DEFAULT '{}';
ALTER TABLE "users" ALTER COLUMN "backupCodes"        SET DEFAULT '{}';
ALTER TABLE "users" ALTER COLUMN "backupCodeSalts"    SET DEFAULT '{}';
