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
-- CẢNH BÁO: tắt trigger chỉ chặn dòng ghi TỪ LÚC NÀY. Dòng đã nạp giữ nguyên cột bóng cũ, mà nhánh lùi
-- về cột gốc CHỈ chạy khi cột bóng NULL — nên nếu sự cố là f_bo_dau cho giá trị SAI, thẻ vẫn trả kết quả
-- sai trên những dòng ấy, im lặng. Gặp trường hợp đó phải tắt CẢ cờ tính năng TIM_KIEM_THE (cán bộ trở
-- lại ô chữ cũ, không đi qua cột bóng), sửa f_bo_dau, rồi nạp lại cột bóng trước khi bật cờ.
--
-- Muốn giấu luôn ô thẻ trên giao diện: tắt cờ tính năng TIM_KIEM_THE (màn danh sách trở lại ô chữ cũ).
-- Bật lại: chạy docs/van-hanh/bat-lai-trigger-tim-kiem.sql rồi nạp lại cột bóng (chỉ dẫn trong tệp ấy).
--
-- LƯU Ý DEPLOY: mỗi migration tìm kiếm mới chạy lại `CREATE OR REPLACE FUNCTION` nên BẬT LẠI trigger.
-- Deploy trong lúc đang tắt khẩn thì chạy lại tệp này ngay sau deploy nếu sự cố chưa xử lý xong.
--
-- Chạy: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/van-hanh/tat-trigger-tim-kiem.sql

BEGIN;

-- ── users: họ tên người nhập / cán bộ (thẻ kiểu người lọc qua quan hệ) ──
-- ── users (nguoi-dung) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_users() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."ho_ten_bd" := NULL;
  NEW."email_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── subjects: họ tên đối tượng (thẻ kiểu đối tượng lọc qua quan hệ) ──
-- ── subjects (doi-tuong) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_subjects() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."full_name_bd" := NULL;
  NEW."id_number_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
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

-- ── incidents (vu-viec) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_incidents() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."chuyen_tu_don_vi_bd" := NULL;
  NEW."ben_vu_bd" := NULL;
  NEW."description_bd" := NULL;
  NEW."don_vi_giai_quyet_bd" := NULL;
  NEW."ket_qua_xu_ly_bd" := NULL;
  NEW."name_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── cases (vu-an) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_cases() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."nguon_don_bd" := NULL;
  NEW."ten_cung_cap_bd" := NULL;
  NEW."mo_ta_chi_tiet_bd" := NULL;
  NEW."don_vi_giai_quyet_bd" := NULL;
  NEW."ket_qua_xu_ly_khac_bd" := NULL;
  NEW."don_vi_giao_bd" := NULL;
  NEW."so_quyet_dinh_uy_thac_bd" := NULL;
  NEW."nghi_van_doi_tuong_bd" := NULL;
  NEW."crime_bd" := NULL;
  NEW."name_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── lawyers (luat-su) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_lawyers() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."full_name_bd" := NULL;
  NEW."bar_number_bd" := NULL;
  NEW."law_firm_bd" := NULL;
  NEW."phone_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── directories (danh-muc) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_directories() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."name_bd" := NULL;
  NEW."description_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── documents (tai-lieu) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_documents() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."title_bd" := NULL;
  NEW."original_name_bd" := NULL;
  NEW."description_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── address_mappings (anh-xa-dia-chi) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_address_mappings() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."old_ward_bd" := NULL;
  NEW."old_district_bd" := NULL;
  NEW."new_ward_bd" := NULL;
  NEW."note_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── audit_logs (nhat-ky) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_audit_logs() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── guidance_records (huong-dan) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_guidance_records() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."subject_bd" := NULL;
  NEW."unit_bd" := NULL;
  NEW."nguoi_duoc_huong_dan_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── proposals (kien-nghi) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_proposals() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."content_bd" := NULL;
  NEW."unit_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── delegations (uy-thac) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_delegations() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."content_bd" := NULL;
  NEW."receiving_unit_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── exchanges (trao-doi) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_exchanges() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."record_type_bd" := NULL;
  NEW."sender_unit_bd" := NULL;
  NEW."receiver_unit_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

COMMIT;
