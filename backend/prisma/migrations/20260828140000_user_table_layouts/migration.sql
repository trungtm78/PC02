-- Bố cục cột bảng danh sách, riêng từng người dùng.
--
-- Cán bộ tự chỉnh bề rộng cột, ẩn/hiện, thứ tự cột trên các màn danh sách. Trước đây ẩn/hiện
-- lưu ở `localStorage` từng máy: đổi máy là mất, và cùng một người ngồi hai máy thấy hai kiểu.
--
-- MỘT HÀNG cho mỗi (người dùng, bảng), payload là khối JSON. Khác lối "một hàng mỗi mục" của
-- `user_shortcuts` vì đổi thứ tự cột sửa vị trí NHIỀU cột cùng lúc — một hàng cho phép ghi
-- nguyên tử, không có trạng thái nửa vời khi mạng đứt giữa chừng. Đặt lại = xoá một hàng.
--
-- `columns` CHỈ chứa cột người dùng đã đụng tới. Cột vắng mặt = lấy theo khai báo trong mã,
-- không phải "người dùng đã tắt".
--
-- Bảng SỐNG ĐƯỢC KHI RỖNG: deploy không chạy seed, và người chưa chỉnh gì thì không có hàng
-- nào — giao diện lấy mặc định trong mã.
CREATE TABLE "user_table_layouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tableKey" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_table_layouts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_table_layouts_userId_idx" ON "user_table_layouts"("userId");

-- Một người, một bảng, một bố cục. Thiếu ràng buộc này thì mỗi lần lưu sinh thêm một hàng và
-- lần đọc sau lấy phải bản cũ.
CREATE UNIQUE INDEX "user_table_layouts_userId_tableKey_key" ON "user_table_layouts"("userId", "tableKey");

ALTER TABLE "user_table_layouts" ADD CONSTRAINT "user_table_layouts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
