-- SINH TỰ ĐỘNG từ backend/src/common/tim-kiem/khai/*.khai.ts bằng `npm run gen:tim-kiem` — không sửa tay.
--
-- TẮT KHẨN trigger tìm kiếm — chạy tay trên CSDL khi trigger cột bóng gây sự cố (ghi hồ sơ chậm,
-- nhật ký PostgreSQL đầy cảnh báo `pc02_dat_tim_kiem_*`, hàm f_bo_dau hỏng). Không cần deploy.
--
-- Làm gì: thay thân hàm trigger bằng bản chỉ đặt cột bóng = NULL. Dòng được sửa từ lúc này có cột
-- bóng NULL, thẻ tìm kiếm LÙI VỀ CỘT GỐC cho dòng ấy — kết quả vẫn đúng, chỉ chậm hơn. KHÔNG gỡ
-- trigger: gỡ thì cột bóng cũ nằm lại trên dòng đã sửa và thẻ trả SAI mà không ai biết.
-- Không đụng dữ liệu nghiệp vụ, không đổi cấu trúc bảng.
--
-- Muốn giấu luôn ô thẻ trên giao diện: tắt cờ tính năng TIM_KIEM_THE (màn danh sách trở lại ô chữ cũ).
-- Bật lại: chạy docs/van-hanh/bat-lai-trigger-tim-kiem.sql rồi nạp lại cột bóng (chỉ dẫn trong tệp ấy).
--
-- Chạy: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/van-hanh/tat-trigger-tim-kiem.sql

BEGIN;

-- ── users: họ tên người nhập / cán bộ (thẻ kiểu người lọc qua quan hệ) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_users() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."ho_ten_bd" := NULL;
  RETURN NEW;
END $$;

-- ── petitions (don-thu) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_petitions() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."nguon_don_bd" := NULL;
  NEW."sender_name_bd" := NULL;
  NEW."detail_content_bd" := NULL;
  NEW."don_vi_giai_quyet_bd" := NULL;
  NEW."ket_qua_xu_ly_khac_bd" := NULL;
  NEW."suspected_person_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

COMMIT;
