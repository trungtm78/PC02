-- SINH TỰ ĐỘNG từ backend/src/common/tim-kiem/khai/*.khai.ts bằng `npm run gen:tim-kiem` — không sửa tay.
--
-- BẬT LẠI trigger tìm kiếm sau khi đã chạy tat-trigger-tim-kiem.sql — thân hàm y hệt migration.
--
-- Sau khi chạy: dòng sửa trong lúc tắt đang có cột bóng NULL (thẻ vẫn đúng nhờ lùi về cột gốc).
-- Nạp lại để chúng dùng lại chỉ mục, từ thư mục backend đang chạy:
--   node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js          # chạy thử, đếm dòng lệch
--   node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js --that   # nạp theo lô, không đẩy updatedAt
--
-- Chạy: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/van-hanh/bat-lai-trigger-tim-kiem.sql

BEGIN;

-- SINH TỰ ĐỘNG từ backend/src/common/tim-kiem/bo-dau.ts (sinhHamFBoDau) — không sửa tay.
CREATE OR REPLACE FUNCTION public.f_bo_dau(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$
  SELECT btrim(regexp_replace(lower(replace(replace(replace(replace(translate(coalesce($1, ''), 'đĐÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿĀāĂăĄąĆćĈĉĊċČčĎďĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĨĩĪīĬĭĮįİĴĵĶķĹĺĻļĽľŃńŅņŇňŌōŎŏŐőŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžƠơƯưǍǎǏǐǑǒǓǔǕǖǗǘǙǚǛǜǞǟǠǡǦǧǨǩǪǫǬǭǰǴǵǸǹǺǻȀȁȂȃȄȅȆȇȈȉȊȋȌȍȎȏȐȑȒȓȔȕȖȗȘșȚțȞȟȦȧȨȩȪȫȬȭȮȯȰȱȲȳḀḁḂḃḄḅḆḇḈḉḊḋḌḍḎḏḐḑḒḓḔḕḖḗḘḙḚḛḜḝḞḟḠḡḢḣḤḥḦḧḨḩḪḫḬḭḮḯḰḱḲḳḴḵḶḷḸḹḺḻḼḽḾḿṀṁṂṃṄṅṆṇṈṉṊṋṌṍṎṏṐṑṒṓṔṕṖṗṘṙṚṛṜṝṞṟṠṡṢṣṤṥṦṧṨṩṪṫṬṭṮṯṰṱṲṳṴṵṶṷṸṹṺṻṼṽṾṿẀẁẂẃẄẅẆẇẈẉẊẋẌẍẎẏẐẑẒẓẔẕẖẗẘẙẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ–—“”‘’·²³                 　﻿̴̵̶̷̸̡̢̧̨̛̖̗̘̙̜̝̞̟̠̣̤̥̦̩̪̫̬̭̮̯̰̱̲̳̹̺̻̼͇͈͉͍͎̀́̂̃̄̅̆̇̈̉̊̋̌̍̎̏̐̑̒̓̔̽̾̿̀́͂̓̈́͆͊͋͌̕̚ͅ͏͓͔͕͖͙͚͐͑͒͗͛ͣͤͥͦͧͨͩͪͫͬͭͮͯ͘͜͟͢͝͞͠͡', 'ddaaaaaaceeeeiiiinooooouuuuyaaaaaaceeeeiiiinooooouuuuyyaaaaaaccccccccddeeeeeeeeeegggggggghhiiiiiiiiijjkkllllllnnnnnnoooooorrrrrrssssssssttttuuuuuuuuuuuuwwyyyzzzzzzoouuaaiioouuuuuuuuuuaaaaggkkoooojggnnaaaaaaeeeeiiiioooorrrruuuusstthhaaeeooooooooyyaabbbbbbccddddddddddeeeeeeeeeeffgghhhhhhhhhhiiiikkkkkkllllllllmmmmmmnnnnnnnnoooooooopppprrrrrrrrssssssssssttttttttuuuuuuuuuuvvvvwwwwwwwwwwxxxxyyzzzzzzhtwyaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeiiiioooooooooooooooooooooooouuuuuuuuuuuuuuyyyyyyyy--""''''.23                   '), '…', '...'), '¼', '1/4'), '½', '1/2'), '¾', '3/4')), '[ \t\n\r\f\v]+', ' ', 'g'))
$f$;

-- ── users: họ tên người nhập / cán bộ (thẻ kiểu người lọc qua quan hệ) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_users() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."ho_ten_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."lastName", NEW."firstName", NEW."username"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_users: %', SQLERRM;
  NEW."ho_ten_bd" := NULL;
  RETURN NEW;
END $$;

-- ── subjects: họ tên đối tượng (thẻ kiểu đối tượng lọc qua quan hệ) ──
-- ── subjects (doi-tuong) ──
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

-- ── petitions (don-thu) ──
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

-- ── incidents (vu-viec) ──
CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_incidents() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."chuyen_tu_don_vi_bd" := ' ' || f_bo_dau(NEW."chuyenTuDonVi");
  NEW."ben_vu_bd" := ' ' || f_bo_dau(NEW."benVu");
  NEW."description_bd" := ' ' || f_bo_dau(NEW."description");
  NEW."don_vi_giai_quyet_bd" := ' ' || f_bo_dau(NEW."donViGiaiQuyet");
  NEW."ket_qua_xu_ly_bd" := ' ' || f_bo_dau(NEW."ketQuaXuLy");
  NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."code", NEW."sttCu", NEW."chuyenTuDonVi", NEW."benVu", NEW."description", NEW."donViGiaiQuyet", NEW."ketQuaXuLy", NEW."name", NEW."doiTuongCaNhan", NEW."doiTuongToChuc", NEW."soHoSoCu"));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pc02_dat_tim_kiem_incidents: %', SQLERRM;
  NEW."chuyen_tu_don_vi_bd" := NULL;
  NEW."ben_vu_bd" := NULL;
  NEW."description_bd" := NULL;
  NEW."don_vi_giai_quyet_bd" := NULL;
  NEW."ket_qua_xu_ly_bd" := NULL;
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── cases (vu-an) ──
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
  NEW."tim_kiem_bd" := NULL;
  RETURN NEW;
END $$;

-- ── lawyers (luat-su) ──
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

COMMIT;
