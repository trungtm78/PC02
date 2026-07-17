-- Thẩm quyền & đơn vị xử lý cho form đăng ký đơn thư
ALTER TABLE "petitions" ADD COLUMN "thuocThamQuyen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "petitions" ADD COLUMN "donViXuLy" TEXT;
