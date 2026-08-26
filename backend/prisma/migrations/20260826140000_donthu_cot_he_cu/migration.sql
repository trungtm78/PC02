-- Ô hệ cũ đưa về đúng vị trí trên form Đơn thư (26/08/2026).
--
-- Chín cột cho những khoá hệ cũ CÓ DỮ LIỆU THẬT mà Đơn thư chưa có chỗ ở. Số hồ sơ đo trên
-- máy chạy, đã loại ô rỗng và hai mốc rỗng "0" / "-25200" của hệ cũ. Ma trận tài liệu đếm
-- theo SỰ CÓ MẶT của khoá nên cao hơn thực tế — bám số đo, không bám ma trận.
--
-- baoCaoBanGiamDocText: hệ cũ nhập tự do, 35.261 hồ sơ có chữ. Cột Boolean cạnh bên chỉ giữ
-- được CÓ/KHÔNG, nên chữ bị mất — cùng cách đã vá cho Vụ án.
--
-- Additive: mọi cột đều nullable, không đụng dữ liệu đang có.
ALTER TABLE "petitions" ADD COLUMN "baoCaoBanGiamDocText"     TEXT;
ALTER TABLE "petitions" ADD COLUMN "tinhTrang"                TEXT;
ALTER TABLE "petitions" ADD COLUMN "soQDPhanCongNguonTin"     TEXT;
ALTER TABLE "petitions" ADD COLUMN "ngayQDPhanCongNguonTin"   TIMESTAMP(3);
ALTER TABLE "petitions" ADD COLUMN "soQDTamDinhChiNguonTin"   TEXT;
ALTER TABLE "petitions" ADD COLUMN "ngayQDTamDinhChiNguonTin" TIMESTAMP(3);
ALTER TABLE "petitions" ADD COLUMN "canCuTamDinhChiNguonTin"  TEXT;
ALTER TABLE "petitions" ADD COLUMN "soPhucHoiNguonTin"        TEXT;
ALTER TABLE "petitions" ADD COLUMN "ngayPhucHoiNguonTin"      TIMESTAMP(3);
