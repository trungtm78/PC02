-- Mật độ dòng của bảng danh sách, nhớ theo cán bộ (18/09/2026, PR-F2).
-- Cột được để trống: hàng cũ = mặc định 'doc'. Thêm cột trống không khoá bảng lâu (không ghi lại dòng nào).
ALTER TABLE "user_table_layouts" ADD COLUMN "matDo" TEXT;
