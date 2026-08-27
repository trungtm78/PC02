-- Vụ việc: ba cột cho ô hệ cũ còn kẹt ở `legacyRaw`.
--
-- Số đo trên máy chạy 27/08/2026 (đã loại rỗng và hai mốc rỗng "0"/"-25200"):
--   crimeChinhId            1.114 hồ sơ mang mã tội danh cũ — Đơn thư và Vụ án đều đã có cột
--                           này, riêng Vụ việc thì chưa, nên tra cứu theo tội danh sót hẳn
--                           một giai đoạn tố tụng.
--   phanLoaiNguonTinBanDau  4.568 — ô thứ hai của tab Thông tin bên hệ cũ, và là ô quyết định
--                           hồ sơ nằm ở danh sách nào. Không có cột thì mở hồ sơ ra ô ấy trắng.
--   baoCaoBanGiamDocText    93 — nội dung chỉ đạo Ban Giám đốc. Cột `baoCaoBanGiamDoc` là
--                           ĐÚNG/SAI suy từ chữ; một cột một bit giữ không nổi chữ.
--
-- Additive, nullable, plain CREATE INDEX (bài học v0.40: CONCURRENTLY hỏng trong migration
-- Prisma vì chạy trong giao dịch). Không khoá bảng lâu, không đổi hành vi bản ghi đang có.
ALTER TABLE "incidents" ADD COLUMN "crimeChinhId" TEXT;
ALTER TABLE "incidents" ADD COLUMN "phanLoaiNguonTinBanDau" TEXT;
ALTER TABLE "incidents" ADD COLUMN "baoCaoBanGiamDocText" TEXT;

CREATE INDEX "incidents_crimeChinhId_idx" ON "incidents"("crimeChinhId");

ALTER TABLE "incidents" ADD CONSTRAINT "incidents_crimeChinhId_fkey"
  FOREIGN KEY ("crimeChinhId") REFERENCES "crimes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
