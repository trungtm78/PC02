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

COMMIT;
