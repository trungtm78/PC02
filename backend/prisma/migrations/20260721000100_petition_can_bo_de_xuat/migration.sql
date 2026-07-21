-- Cán bộ đề xuất trên Phiếu đề xuất (đơn thư).
-- Mặc định = người tạo đơn nhưng cho phép chọn cán bộ khác; khác assignedToId
-- (quyết định phân công) và enteredById (bị ép = actor, chống giả mạo).
ALTER TABLE "petitions" ADD COLUMN "canBoDeXuatId" TEXT;

ALTER TABLE "petitions" ADD CONSTRAINT "petitions_canBoDeXuatId_fkey"
  FOREIGN KEY ("canBoDeXuatId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "petitions_canBoDeXuatId_idx" ON "petitions"("canBoDeXuatId");
