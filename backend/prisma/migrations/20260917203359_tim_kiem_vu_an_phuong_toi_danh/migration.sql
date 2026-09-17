-- SINH TỰ ĐỘNG từ backend/src/common/tim-kiem/khai/*.khai.ts bằng `npm run gen:tim-kiem` — không sửa tay.
--
-- Cột bóng bỏ dấu cho ô tìm dạng thẻ. Migration KHÔNG điền dữ liệu cũ: đo 15/09/2026 trên 47.169
-- đơn thư, điền trong migration khoá bảng ~50 giây lúc deploy. Điền bằng CLI theo lô sau deploy;
-- trong lúc chưa điền, thẻ chữ lùi về cột gốc cho dòng có cột bóng rỗng.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- SINH TỰ ĐỘNG từ backend/src/common/tim-kiem/bo-dau.ts (sinhHamFBoDau) — không sửa tay.
CREATE OR REPLACE FUNCTION public.f_bo_dau(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$
  SELECT btrim(regexp_replace(lower(replace(replace(replace(replace(translate(coalesce($1, ''), 'đĐÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿĀāĂăĄąĆćĈĉĊċČčĎďĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĨĩĪīĬĭĮįİĴĵĶķĹĺĻļĽľŃńŅņŇňŌōŎŏŐőŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžƠơƯưǍǎǏǐǑǒǓǔǕǖǗǘǙǚǛǜǞǟǠǡǦǧǨǩǪǫǬǭǰǴǵǸǹǺǻȀȁȂȃȄȅȆȇȈȉȊȋȌȍȎȏȐȑȒȓȔȕȖȗȘșȚțȞȟȦȧȨȩȪȫȬȭȮȯȰȱȲȳḀḁḂḃḄḅḆḇḈḉḊḋḌḍḎḏḐḑḒḓḔḕḖḗḘḙḚḛḜḝḞḟḠḡḢḣḤḥḦḧḨḩḪḫḬḭḮḯḰḱḲḳḴḵḶḷḸḹḺḻḼḽḾḿṀṁṂṃṄṅṆṇṈṉṊṋṌṍṎṏṐṑṒṓṔṕṖṗṘṙṚṛṜṝṞṟṠṡṢṣṤṥṦṧṨṩṪṫṬṭṮṯṰṱṲṳṴṵṶṷṸṹṺṻṼṽṾṿẀẁẂẃẄẅẆẇẈẉẊẋẌẍẎẏẐẑẒẓẔẕẖẗẘẙẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ–—“”‘’·²³                 　﻿̴̵̶̷̸̡̢̧̨̛̖̗̘̙̜̝̞̟̠̣̤̥̦̩̪̫̬̭̮̯̰̱̲̳̹̺̻̼͇͈͉͍͎̀́̂̃̄̅̆̇̈̉̊̋̌̍̎̏̐̑̒̓̔̽̾̿̀́͂̓̈́͆͊͋͌̕̚ͅ͏͓͔͕͖͙͚͐͑͒͗͛ͣͤͥͦͧͨͩͪͫͬͭͮͯ͘͜͟͢͝͞͠͡', 'ddaaaaaaceeeeiiiinooooouuuuyaaaaaaceeeeiiiinooooouuuuyyaaaaaaccccccccddeeeeeeeeeegggggggghhiiiiiiiiijjkkllllllnnnnnnoooooorrrrrrssssssssttttuuuuuuuuuuuuwwyyyzzzzzzoouuaaiioouuuuuuuuuuaaaaggkkoooojggnnaaaaaaeeeeiiiioooorrrruuuusstthhaaeeooooooooyyaabbbbbbccddddddddddeeeeeeeeeeffgghhhhhhhhhhiiiikkkkkkllllllllmmmmmmnnnnnnnnoooooooopppprrrrrrrrssssssssssttttttttuuuuuuuuuuvvvvwwwwwwwwwwxxxxyyzzzzzzhtwyaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeiiiioooooooooooooooooooooooouuuuuuuuuuuuuuyyyyyyyy--""''''.23                   '), '…', '...'), '¼', '1/4'), '½', '1/2'), '¾', '3/4')), '[ \t\n\r\f\v]+', ' ', 'g'))
$f$;

-- ── users: họ tên người nhập / cán bộ (thẻ kiểu người lọc qua quan hệ) ──
-- ── users (nguoi-dung) ──
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ho_ten_bd" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_bd" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_users() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."ho_ten_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."lastName", NEW."firstName", NEW."username"));
  NEW."email_bd" := ' ' || f_bo_dau(NEW."email");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."workId", NEW."lastName", NEW."firstName", NEW."username", NEW."email"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_users: %', SQLERRM;
  NEW."ho_ten_bd" := NULL;
  NEW."email_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_users ON "users";
CREATE TRIGGER pc02_tim_kiem_users
  BEFORE INSERT OR UPDATE OF "lastName", "firstName", "username", "workId", "email" ON "users"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_users();

CREATE INDEX IF NOT EXISTS "users_ho_ten_bd_trgm" ON "users" USING gin ("ho_ten_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_email_bd_trgm" ON "users" USING gin ("email_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_tim_kiem_bd_trgm" ON "users" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_tim_kiem_bd_chua_nap" ON "users" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── subjects: họ tên đối tượng (thẻ kiểu đối tượng lọc qua quan hệ) ──
-- ── subjects (doi-tuong) ──
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "full_name_bd" text;
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "id_number_bd" text;
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_subjects() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."full_name_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."fullName"));
  NEW."id_number_bd" := ' ' || f_bo_dau(NEW."idNumber");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."fullName", NEW."idNumber", NEW."address", NEW."phone"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_subjects: %', SQLERRM;
  NEW."full_name_bd" := NULL;
  NEW."id_number_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_subjects ON "subjects";
CREATE TRIGGER pc02_tim_kiem_subjects
  BEFORE INSERT OR UPDATE OF "fullName", "idNumber", "address", "phone" ON "subjects"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_subjects();

CREATE INDEX IF NOT EXISTS "subjects_full_name_bd_trgm" ON "subjects" USING gin ("full_name_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "subjects_id_number_bd_trgm" ON "subjects" USING gin ("id_number_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "subjects_tim_kiem_bd_trgm" ON "subjects" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "subjects_tim_kiem_bd_chua_nap" ON "subjects" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── petitions (don-thu) ──
ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "nguon_don_bd" text;
ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "sender_name_bd" text;
ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "detail_content_bd" text;
ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "don_vi_giai_quyet_bd" text;
ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "ket_qua_xu_ly_khac_bd" text;
ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "suspected_person_bd" text;
ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_petitions() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."nguon_don_bd" := ' ' || f_bo_dau(NEW."nguonDon");
  NEW."sender_name_bd" := ' ' || f_bo_dau(NEW."senderName");
  NEW."detail_content_bd" := ' ' || f_bo_dau(NEW."detailContent");
  NEW."don_vi_giai_quyet_bd" := ' ' || f_bo_dau(NEW."donViGiaiQuyet");
  NEW."ket_qua_xu_ly_khac_bd" := ' ' || f_bo_dau(NEW."ketQuaXuLyKhac");
  NEW."suspected_person_bd" := ' ' || f_bo_dau(NEW."suspectedPerson");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."stt", NEW."sttCu", NEW."nguonDon", NEW."senderName", NEW."detailContent", NEW."donViGiaiQuyet", NEW."ketQuaXuLyKhac", NEW."suspectedPerson", NEW."soHoSoCu"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_petitions: %', SQLERRM;
  NEW."nguon_don_bd" := NULL;
  NEW."sender_name_bd" := NULL;
  NEW."detail_content_bd" := NULL;
  NEW."don_vi_giai_quyet_bd" := NULL;
  NEW."ket_qua_xu_ly_khac_bd" := NULL;
  NEW."suspected_person_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_petitions ON "petitions";
CREATE TRIGGER pc02_tim_kiem_petitions
  BEFORE INSERT OR UPDATE OF "stt", "sttCu", "nguonDon", "senderName", "detailContent", "donViGiaiQuyet", "ketQuaXuLyKhac", "suspectedPerson", "soHoSoCu" ON "petitions"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_petitions();

CREATE INDEX IF NOT EXISTS "petitions_nguon_don_bd_trgm" ON "petitions" USING gin ("nguon_don_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "petitions_sender_name_bd_trgm" ON "petitions" USING gin ("sender_name_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "petitions_detail_content_bd_trgm" ON "petitions" USING gin ("detail_content_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "petitions_don_vi_giai_quyet_bd_trgm" ON "petitions" USING gin ("don_vi_giai_quyet_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "petitions_ket_qua_xu_ly_khac_bd_trgm" ON "petitions" USING gin ("ket_qua_xu_ly_khac_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "petitions_suspected_person_bd_trgm" ON "petitions" USING gin ("suspected_person_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "petitions_tim_kiem_bd_trgm" ON "petitions" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "petitions_tim_kiem_bd_chua_nap" ON "petitions" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── incidents (vu-viec) ──
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "chuyen_tu_don_vi_bd" text;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "ben_vu_bd" text;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "description_bd" text;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "don_vi_giai_quyet_bd" text;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "ket_qua_xu_ly_bd" text;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "name_bd" text;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_incidents() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."chuyen_tu_don_vi_bd" := ' ' || f_bo_dau(NEW."chuyenTuDonVi");
  NEW."ben_vu_bd" := ' ' || f_bo_dau(NEW."benVu");
  NEW."description_bd" := ' ' || f_bo_dau(NEW."description");
  NEW."don_vi_giai_quyet_bd" := ' ' || f_bo_dau(NEW."donViGiaiQuyet");
  NEW."ket_qua_xu_ly_bd" := ' ' || f_bo_dau(NEW."ketQuaXuLy");
  NEW."name_bd" := ' ' || f_bo_dau(NEW."name");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."code", NEW."sttCu", NEW."chuyenTuDonVi", NEW."benVu", NEW."description", NEW."donViGiaiQuyet", NEW."ketQuaXuLy", NEW."name", NEW."doiTuongCaNhan", NEW."doiTuongToChuc", NEW."soHoSoCu"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_incidents: %', SQLERRM;
  NEW."chuyen_tu_don_vi_bd" := NULL;
  NEW."ben_vu_bd" := NULL;
  NEW."description_bd" := NULL;
  NEW."don_vi_giai_quyet_bd" := NULL;
  NEW."ket_qua_xu_ly_bd" := NULL;
  NEW."name_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_incidents ON "incidents";
CREATE TRIGGER pc02_tim_kiem_incidents
  BEFORE INSERT OR UPDATE OF "code", "sttCu", "chuyenTuDonVi", "benVu", "description", "donViGiaiQuyet", "ketQuaXuLy", "name", "doiTuongCaNhan", "doiTuongToChuc", "soHoSoCu" ON "incidents"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_incidents();

CREATE INDEX IF NOT EXISTS "incidents_chuyen_tu_don_vi_bd_trgm" ON "incidents" USING gin ("chuyen_tu_don_vi_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "incidents_ben_vu_bd_trgm" ON "incidents" USING gin ("ben_vu_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "incidents_description_bd_trgm" ON "incidents" USING gin ("description_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "incidents_don_vi_giai_quyet_bd_trgm" ON "incidents" USING gin ("don_vi_giai_quyet_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "incidents_ket_qua_xu_ly_bd_trgm" ON "incidents" USING gin ("ket_qua_xu_ly_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "incidents_name_bd_trgm" ON "incidents" USING gin ("name_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "incidents_tim_kiem_bd_trgm" ON "incidents" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "incidents_tim_kiem_bd_chua_nap" ON "incidents" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── cases (vu-an) ──
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "nguon_don_bd" text;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "ten_cung_cap_bd" text;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "mo_ta_chi_tiet_bd" text;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "don_vi_giai_quyet_bd" text;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "ket_qua_xu_ly_khac_bd" text;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "don_vi_giao_bd" text;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "so_quyet_dinh_uy_thac_bd" text;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "nghi_van_doi_tuong_bd" text;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "crime_bd" text;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "name_bd" text;
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_cases() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."nguon_don_bd" := ' ' || f_bo_dau(NEW."nguonDon");
  NEW."ten_cung_cap_bd" := ' ' || f_bo_dau(NEW."tenCungCap");
  NEW."mo_ta_chi_tiet_bd" := ' ' || f_bo_dau(NEW."moTaChiTiet");
  NEW."don_vi_giai_quyet_bd" := ' ' || f_bo_dau(NEW."donViGiaiQuyet");
  NEW."ket_qua_xu_ly_khac_bd" := ' ' || f_bo_dau(NEW."ketQuaXuLyKhac");
  NEW."don_vi_giao_bd" := ' ' || f_bo_dau(NEW."don_vi_giao");
  NEW."so_quyet_dinh_uy_thac_bd" := ' ' || f_bo_dau(NEW."so_quyet_dinh_uy_thac");
  NEW."nghi_van_doi_tuong_bd" := ' ' || f_bo_dau(NEW."nghiVanDoiTuong");
  NEW."crime_bd" := ' ' || f_bo_dau(NEW."crime");
  NEW."name_bd" := ' ' || f_bo_dau(NEW."name");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."caseCode", NEW."sttCu", NEW."nguonDon", NEW."tenCungCap", NEW."moTaChiTiet", NEW."donViGiaiQuyet", NEW."ketQuaXuLyKhac", NEW."don_vi_giao", NEW."so_quyet_dinh_uy_thac", NEW."nghiVanDoiTuong", NEW."crime", NEW."name", NEW."soHoSoCu"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_cases: %', SQLERRM;
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

DROP TRIGGER IF EXISTS pc02_tim_kiem_cases ON "cases";
CREATE TRIGGER pc02_tim_kiem_cases
  BEFORE INSERT OR UPDATE OF "caseCode", "sttCu", "nguonDon", "tenCungCap", "moTaChiTiet", "donViGiaiQuyet", "ketQuaXuLyKhac", "don_vi_giao", "so_quyet_dinh_uy_thac", "nghiVanDoiTuong", "crime", "name", "soHoSoCu" ON "cases"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_cases();

CREATE INDEX IF NOT EXISTS "cases_nguon_don_bd_trgm" ON "cases" USING gin ("nguon_don_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "cases_ten_cung_cap_bd_trgm" ON "cases" USING gin ("ten_cung_cap_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "cases_mo_ta_chi_tiet_bd_trgm" ON "cases" USING gin ("mo_ta_chi_tiet_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "cases_don_vi_giai_quyet_bd_trgm" ON "cases" USING gin ("don_vi_giai_quyet_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "cases_ket_qua_xu_ly_khac_bd_trgm" ON "cases" USING gin ("ket_qua_xu_ly_khac_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "cases_don_vi_giao_bd_trgm" ON "cases" USING gin ("don_vi_giao_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "cases_so_quyet_dinh_uy_thac_bd_trgm" ON "cases" USING gin ("so_quyet_dinh_uy_thac_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "cases_nghi_van_doi_tuong_bd_trgm" ON "cases" USING gin ("nghi_van_doi_tuong_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "cases_crime_bd_trgm" ON "cases" USING gin ("crime_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "cases_name_bd_trgm" ON "cases" USING gin ("name_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "cases_tim_kiem_bd_trgm" ON "cases" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "cases_tim_kiem_bd_chua_nap" ON "cases" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── lawyers (luat-su) ──
ALTER TABLE "lawyers" ADD COLUMN IF NOT EXISTS "full_name_bd" text;
ALTER TABLE "lawyers" ADD COLUMN IF NOT EXISTS "bar_number_bd" text;
ALTER TABLE "lawyers" ADD COLUMN IF NOT EXISTS "law_firm_bd" text;
ALTER TABLE "lawyers" ADD COLUMN IF NOT EXISTS "phone_bd" text;
ALTER TABLE "lawyers" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_lawyers() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."full_name_bd" := ' ' || f_bo_dau(NEW."fullName");
  NEW."bar_number_bd" := ' ' || f_bo_dau(NEW."barNumber");
  NEW."law_firm_bd" := ' ' || f_bo_dau(NEW."lawFirm");
  NEW."phone_bd" := ' ' || f_bo_dau(NEW."phone");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."fullName", NEW."barNumber", NEW."lawFirm", NEW."phone"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_lawyers: %', SQLERRM;
  NEW."full_name_bd" := NULL;
  NEW."bar_number_bd" := NULL;
  NEW."law_firm_bd" := NULL;
  NEW."phone_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_lawyers ON "lawyers";
CREATE TRIGGER pc02_tim_kiem_lawyers
  BEFORE INSERT OR UPDATE OF "fullName", "barNumber", "lawFirm", "phone" ON "lawyers"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_lawyers();

CREATE INDEX IF NOT EXISTS "lawyers_full_name_bd_trgm" ON "lawyers" USING gin ("full_name_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lawyers_bar_number_bd_trgm" ON "lawyers" USING gin ("bar_number_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lawyers_law_firm_bd_trgm" ON "lawyers" USING gin ("law_firm_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lawyers_phone_bd_trgm" ON "lawyers" USING gin ("phone_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lawyers_tim_kiem_bd_trgm" ON "lawyers" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lawyers_tim_kiem_bd_chua_nap" ON "lawyers" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── directories (danh-muc) ──
ALTER TABLE "directories" ADD COLUMN IF NOT EXISTS "name_bd" text;
ALTER TABLE "directories" ADD COLUMN IF NOT EXISTS "description_bd" text;
ALTER TABLE "directories" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_directories() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."name_bd" := ' ' || f_bo_dau(NEW."name");
  NEW."description_bd" := ' ' || f_bo_dau(NEW."description");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."code", NEW."name", NEW."description"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_directories: %', SQLERRM;
  NEW."name_bd" := NULL;
  NEW."description_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_directories ON "directories";
CREATE TRIGGER pc02_tim_kiem_directories
  BEFORE INSERT OR UPDATE OF "code", "name", "description" ON "directories"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_directories();

CREATE INDEX IF NOT EXISTS "directories_name_bd_trgm" ON "directories" USING gin ("name_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "directories_description_bd_trgm" ON "directories" USING gin ("description_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "directories_tim_kiem_bd_trgm" ON "directories" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "directories_tim_kiem_bd_chua_nap" ON "directories" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── documents (tai-lieu) ──
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "title_bd" text;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "original_name_bd" text;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "description_bd" text;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_documents() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."title_bd" := ' ' || f_bo_dau(NEW."title");
  NEW."original_name_bd" := ' ' || f_bo_dau(NEW."originalName");
  NEW."description_bd" := ' ' || f_bo_dau(NEW."description");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."title", NEW."originalName", NEW."description"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_documents: %', SQLERRM;
  NEW."title_bd" := NULL;
  NEW."original_name_bd" := NULL;
  NEW."description_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_documents ON "documents";
CREATE TRIGGER pc02_tim_kiem_documents
  BEFORE INSERT OR UPDATE OF "title", "originalName", "description" ON "documents"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_documents();

CREATE INDEX IF NOT EXISTS "documents_title_bd_trgm" ON "documents" USING gin ("title_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "documents_original_name_bd_trgm" ON "documents" USING gin ("original_name_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "documents_description_bd_trgm" ON "documents" USING gin ("description_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "documents_tim_kiem_bd_trgm" ON "documents" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "documents_tim_kiem_bd_chua_nap" ON "documents" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── address_mappings (anh-xa-dia-chi) ──
ALTER TABLE "address_mappings" ADD COLUMN IF NOT EXISTS "old_ward_bd" text;
ALTER TABLE "address_mappings" ADD COLUMN IF NOT EXISTS "old_district_bd" text;
ALTER TABLE "address_mappings" ADD COLUMN IF NOT EXISTS "new_ward_bd" text;
ALTER TABLE "address_mappings" ADD COLUMN IF NOT EXISTS "note_bd" text;
ALTER TABLE "address_mappings" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_address_mappings() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."old_ward_bd" := ' ' || f_bo_dau(NEW."oldWard");
  NEW."old_district_bd" := ' ' || f_bo_dau(NEW."oldDistrict");
  NEW."new_ward_bd" := ' ' || f_bo_dau(NEW."newWard");
  NEW."note_bd" := ' ' || f_bo_dau(NEW."note");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."oldWard", NEW."oldDistrict", NEW."newWard", NEW."province", NEW."note"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_address_mappings: %', SQLERRM;
  NEW."old_ward_bd" := NULL;
  NEW."old_district_bd" := NULL;
  NEW."new_ward_bd" := NULL;
  NEW."note_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_address_mappings ON "address_mappings";
CREATE TRIGGER pc02_tim_kiem_address_mappings
  BEFORE INSERT OR UPDATE OF "oldWard", "oldDistrict", "newWard", "province", "note" ON "address_mappings"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_address_mappings();

CREATE INDEX IF NOT EXISTS "address_mappings_old_ward_bd_trgm" ON "address_mappings" USING gin ("old_ward_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "address_mappings_old_district_bd_trgm" ON "address_mappings" USING gin ("old_district_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "address_mappings_new_ward_bd_trgm" ON "address_mappings" USING gin ("new_ward_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "address_mappings_note_bd_trgm" ON "address_mappings" USING gin ("note_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "address_mappings_tim_kiem_bd_trgm" ON "address_mappings" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "address_mappings_tim_kiem_bd_chua_nap" ON "address_mappings" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── audit_logs (nhat-ky) ──
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_audit_logs() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."action", NEW."subject", NEW."subjectId", NEW."ipAddress"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_audit_logs: %', SQLERRM;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_audit_logs ON "audit_logs";
CREATE TRIGGER pc02_tim_kiem_audit_logs
  BEFORE INSERT OR UPDATE OF "action", "subject", "subjectId", "ipAddress" ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_audit_logs();

CREATE INDEX IF NOT EXISTS "audit_logs_tim_kiem_bd_trgm" ON "audit_logs" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "audit_logs_tim_kiem_bd_chua_nap" ON "audit_logs" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── guidance_records (huong-dan) ──
ALTER TABLE "guidance_records" ADD COLUMN IF NOT EXISTS "subject_bd" text;
ALTER TABLE "guidance_records" ADD COLUMN IF NOT EXISTS "unit_bd" text;
ALTER TABLE "guidance_records" ADD COLUMN IF NOT EXISTS "nguoi_duoc_huong_dan_bd" text;
ALTER TABLE "guidance_records" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_guidance_records() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."subject_bd" := ' ' || f_bo_dau(NEW."subject");
  NEW."unit_bd" := ' ' || f_bo_dau(NEW."unit");
  NEW."nguoi_duoc_huong_dan_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."guidedPerson", NEW."guidedPersonPhone"));
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."subject", NEW."unit", NEW."guidedPerson", NEW."guidedPersonPhone", NEW."guidanceContent"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_guidance_records: %', SQLERRM;
  NEW."subject_bd" := NULL;
  NEW."unit_bd" := NULL;
  NEW."nguoi_duoc_huong_dan_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_guidance_records ON "guidance_records";
CREATE TRIGGER pc02_tim_kiem_guidance_records
  BEFORE INSERT OR UPDATE OF "subject", "unit", "guidedPerson", "guidedPersonPhone", "guidanceContent" ON "guidance_records"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_guidance_records();

CREATE INDEX IF NOT EXISTS "guidance_records_subject_bd_trgm" ON "guidance_records" USING gin ("subject_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "guidance_records_unit_bd_trgm" ON "guidance_records" USING gin ("unit_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "guidance_records_nguoi_duoc_huong_dan_bd_trgm" ON "guidance_records" USING gin ("nguoi_duoc_huong_dan_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "guidance_records_tim_kiem_bd_trgm" ON "guidance_records" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "guidance_records_tim_kiem_bd_chua_nap" ON "guidance_records" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── proposals (kien-nghi) ──
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "content_bd" text;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "unit_bd" text;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_proposals() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."content_bd" := ' ' || f_bo_dau(NEW."content");
  NEW."unit_bd" := ' ' || f_bo_dau(NEW."unit");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."proposalNumber", NEW."content", NEW."unit"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_proposals: %', SQLERRM;
  NEW."content_bd" := NULL;
  NEW."unit_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_proposals ON "proposals";
CREATE TRIGGER pc02_tim_kiem_proposals
  BEFORE INSERT OR UPDATE OF "proposalNumber", "content", "unit" ON "proposals"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_proposals();

CREATE INDEX IF NOT EXISTS "proposals_content_bd_trgm" ON "proposals" USING gin ("content_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "proposals_unit_bd_trgm" ON "proposals" USING gin ("unit_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "proposals_tim_kiem_bd_trgm" ON "proposals" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "proposals_tim_kiem_bd_chua_nap" ON "proposals" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── delegations (uy-thac) ──
ALTER TABLE "delegations" ADD COLUMN IF NOT EXISTS "content_bd" text;
ALTER TABLE "delegations" ADD COLUMN IF NOT EXISTS "receiving_unit_bd" text;
ALTER TABLE "delegations" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_delegations() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."content_bd" := ' ' || f_bo_dau(NEW."content");
  NEW."receiving_unit_bd" := ' ' || f_bo_dau(NEW."receivingUnit");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."delegationNumber", NEW."content", NEW."receivingUnit"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_delegations: %', SQLERRM;
  NEW."content_bd" := NULL;
  NEW."receiving_unit_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_delegations ON "delegations";
CREATE TRIGGER pc02_tim_kiem_delegations
  BEFORE INSERT OR UPDATE OF "delegationNumber", "content", "receivingUnit" ON "delegations"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_delegations();

CREATE INDEX IF NOT EXISTS "delegations_content_bd_trgm" ON "delegations" USING gin ("content_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "delegations_receiving_unit_bd_trgm" ON "delegations" USING gin ("receiving_unit_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "delegations_tim_kiem_bd_trgm" ON "delegations" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "delegations_tim_kiem_bd_chua_nap" ON "delegations" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── exchanges (trao-doi) ──
ALTER TABLE "exchanges" ADD COLUMN IF NOT EXISTS "record_type_bd" text;
ALTER TABLE "exchanges" ADD COLUMN IF NOT EXISTS "sender_unit_bd" text;
ALTER TABLE "exchanges" ADD COLUMN IF NOT EXISTS "receiver_unit_bd" text;
ALTER TABLE "exchanges" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_exchanges() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."record_type_bd" := ' ' || f_bo_dau(NEW."recordType");
  NEW."sender_unit_bd" := ' ' || f_bo_dau(NEW."senderUnit");
  NEW."receiver_unit_bd" := ' ' || f_bo_dau(NEW."receiverUnit");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."recordCode", NEW."recordType", NEW."senderUnit", NEW."receiverUnit", NEW."subject"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_exchanges: %', SQLERRM;
  NEW."record_type_bd" := NULL;
  NEW."sender_unit_bd" := NULL;
  NEW."receiver_unit_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_exchanges ON "exchanges";
CREATE TRIGGER pc02_tim_kiem_exchanges
  BEFORE INSERT OR UPDATE OF "recordCode", "recordType", "senderUnit", "receiverUnit", "subject" ON "exchanges"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_exchanges();

CREATE INDEX IF NOT EXISTS "exchanges_record_type_bd_trgm" ON "exchanges" USING gin ("record_type_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "exchanges_sender_unit_bd_trgm" ON "exchanges" USING gin ("sender_unit_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "exchanges_receiver_unit_bd_trgm" ON "exchanges" USING gin ("receiver_unit_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "exchanges_tim_kiem_bd_trgm" ON "exchanges" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "exchanges_tim_kiem_bd_chua_nap" ON "exchanges" ("id") WHERE "tim_kiem_bd" IS NULL;

-- ── crimes (toi-danh) ──
ALTER TABLE "crimes" ADD COLUMN IF NOT EXISTS "name_bd" text;
ALTER TABLE "crimes" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;

CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_crimes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."name_bd" := ' ' || f_bo_dau(NEW."name");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."code", NEW."name"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_crimes: %', SQLERRM;
  NEW."name_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pc02_tim_kiem_crimes ON "crimes";
CREATE TRIGGER pc02_tim_kiem_crimes
  BEFORE INSERT OR UPDATE OF "code", "name" ON "crimes"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_crimes();

CREATE INDEX IF NOT EXISTS "crimes_name_bd_trgm" ON "crimes" USING gin ("name_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "crimes_tim_kiem_bd_trgm" ON "crimes" USING gin ("tim_kiem_bd" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "crimes_tim_kiem_bd_chua_nap" ON "crimes" ("id") WHERE "tim_kiem_bd" IS NULL;
