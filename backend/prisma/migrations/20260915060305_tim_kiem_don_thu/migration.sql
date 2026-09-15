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
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ho_ten_bd" text;

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

DROP TRIGGER IF EXISTS pc02_tim_kiem_users ON "users";
CREATE TRIGGER pc02_tim_kiem_users
  BEFORE INSERT OR UPDATE OF "lastName", "firstName", "username" ON "users"
  FOR EACH ROW EXECUTE FUNCTION pc02_dat_tim_kiem_users();

CREATE INDEX IF NOT EXISTS "users_ho_ten_bd_trgm" ON "users" USING gin ("ho_ten_bd" gin_trgm_ops);

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
