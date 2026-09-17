-- Cột chuẩn hoá phục vụ màn Đơn trùng (18/09/2026).
--
-- Gom nhóm trùng bằng so NGUYÊN VĂN thì "Toà án nhân dân Quận 5" và "Tòa án Nhân dân quận 5" là hai
-- nhóm khác nhau; gom bằng cột bóng BỎ DẤU thì "Hồ Vĩnh Thanh" gộp nhầm với "Hồ Vĩnh Thạnh" — đo prod
-- 17/09/2026 thấy cả hai lỗi. Cột dưới đây GIỮ DẤU THANH, chỉ quy về một dạng Unicode (NFC), một cách
-- đặt dấu (hoà→hòa, uỷ→ủy), không hoa thường và gộp khoảng trắng. Đo lại trên prod: 7.571 nhóm /
-- 29.788 đơn, nhiều hơn so nguyên văn 838 đơn, không nhóm nào gộp nhầm hai người khác tên.
--
-- Cột SINH TỰ ĐỘNG (GENERATED … STORED): không trigger, không CLI nạp, không lệch với cột gốc.
ALTER TABLE "petitions"
  ADD COLUMN IF NOT EXISTS "sender_name_chuan" text GENERATED ALWAYS AS (nullif(btrim(regexp_replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(normalize(coalesce("senderName", ''), NFC)), 'oà', 'òa'), 'oá', 'óa'), 'oả', 'ỏa'), 'oã', 'õa'), 'oạ', 'ọa'), 'oè', 'òe'), 'oé', 'óe'), 'oẻ', 'ỏe'), 'oẽ', 'õe'), 'oẹ', 'ọe'), 'uỳ', 'ùy'), 'uý', 'úy'), 'uỷ', 'ủy'), 'uỹ', 'ũy'), 'uỵ', 'ụy'), '\s+', ' ', 'g')), '')) STORED,
  ADD COLUMN IF NOT EXISTS "sender_address_chuan" text GENERATED ALWAYS AS (nullif(btrim(regexp_replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(normalize(coalesce("senderAddress", ''), NFC)), 'oà', 'òa'), 'oá', 'óa'), 'oả', 'ỏa'), 'oã', 'õa'), 'oạ', 'ọa'), 'oè', 'òe'), 'oé', 'óe'), 'oẻ', 'ỏe'), 'oẽ', 'õe'), 'oẹ', 'ọe'), 'uỳ', 'ùy'), 'uý', 'úy'), 'uỷ', 'ủy'), 'uỹ', 'ũy'), 'uỵ', 'ụy'), '\s+', ' ', 'g')), '')) STORED,
  ADD COLUMN IF NOT EXISTS "suspected_person_chuan" text GENERATED ALWAYS AS (nullif(btrim(regexp_replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(normalize(coalesce("suspectedPerson", ''), NFC)), 'oà', 'òa'), 'oá', 'óa'), 'oả', 'ỏa'), 'oã', 'õa'), 'oạ', 'ọa'), 'oè', 'òe'), 'oé', 'óe'), 'oẻ', 'ỏe'), 'oẽ', 'õe'), 'oẹ', 'ọe'), 'uỳ', 'ùy'), 'uý', 'úy'), 'uỷ', 'ủy'), 'uỹ', 'ũy'), 'uỵ', 'ụy'), '\s+', ' ', 'g')), '')) STORED,
  -- Số điện thoại: chỉ giữ chữ số, để "0903 123 456" và "0903.123.456" cùng một nhóm.
  ADD COLUMN IF NOT EXISTS "sender_phone_chuan" text GENERATED ALWAYS AS (nullif(regexp_replace(coalesce("senderPhone", ''), '[^0-9]', '', 'g'), '')) STORED;

CREATE INDEX IF NOT EXISTS "petitions_sender_name_chuan_idx" ON "petitions" ("sender_name_chuan");
CREATE INDEX IF NOT EXISTS "petitions_sender_address_chuan_idx" ON "petitions" ("sender_address_chuan");
CREATE INDEX IF NOT EXISTS "petitions_suspected_person_chuan_idx" ON "petitions" ("suspected_person_chuan");
CREATE INDEX IF NOT EXISTS "petitions_sender_phone_chuan_idx" ON "petitions" ("sender_phone_chuan");
