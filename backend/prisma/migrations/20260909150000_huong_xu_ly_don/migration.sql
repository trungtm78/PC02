-- Hướng xử lý đơn thư — thay ô tích "Thuộc thẩm quyền" bằng ba lựa chọn.
--
-- Backfill KHÔNG mặc định tất cả thành GIAO_DON. Hồ sơ cũ đã mang sẵn hướng trong trạng thái
-- (đợt suy trạng thái 11.785 hồ sơ ngày 30/08/2026): in một hồ sơ ĐÃ CHUYỂN ĐI thành câu
-- "Giao … tiếp nhận kiểm tra, xác minh" là nói sai việc đã làm, mà bản in trông vẫn hợp lệ nên
-- không ai phát hiện.

CREATE TYPE "huong_xu_ly_don" AS ENUM ('GIAO_DON', 'CHUYEN_DON', 'TRA_LUU_DON');

ALTER TABLE "petitions" ADD COLUMN "huongXuLy" "huong_xu_ly_don";

-- Suy hướng từ trạng thái. Ba câu UPDATE tách rời để đếm được từng nhóm khi chạy.
UPDATE "petitions" SET "huongXuLy" = 'CHUYEN_DON'
  WHERE "status" = 'DA_CHUYEN_DON_VI' AND "huongXuLy" IS NULL;

UPDATE "petitions" SET "huongXuLy" = 'TRA_LUU_DON'
  WHERE "status" IN ('DA_TRA_DON', 'DA_LUU_DON') AND "huongXuLy" IS NULL;

-- Còn lại → GIAO_DON, đúng bằng hành vi bản in hiện tại (đã đo khớp hệ cũ 22/22 mục).
UPDATE "petitions" SET "huongXuLy" = 'GIAO_DON' WHERE "huongXuLy" IS NULL;
