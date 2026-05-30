-- v0.52 — Cho phép Đơn thư (Petition) đính kèm tài liệu thật sự (file upload).
--
-- Trước v0.52: Document chỉ liên kết Case/Incident. Petition chỉ có text
-- attachmentsNote (file storage out-of-scope per comment cũ). User báo cáo:
-- Petition cần upload PDF/Word/ảnh y hệt Cases — không có FK petitionId thì
-- backend Document model không thể link, mặc dù endpoint POST /documents
-- và TabBusinessFiles pattern đã sẵn sàng (re-use).
--
-- Decision T1 (gate /autoplan): onDelete = RESTRICT (không SetNull như
-- caseId/incidentId). Chain-of-custody cho đơn thư — Petition soft-delete
-- (deletedAt) vẫn bình thường, nhưng hard-delete Petition bị chặn nếu còn
-- Document đính kèm. Bắt user dọn document trước khi xoá vĩnh viễn đơn.
--
-- Migration safety:
-- - Cột nullable + index thường — Postgres tạo lock nhẹ, an toàn cho PC02 prod
--   (~100 docs hiện tại, không có concurrent-write hazard ở scale này).
-- - Skip CREATE INDEX CONCURRENTLY (xem PR1 v0.40 lesson — Prisma không hỗ trợ).
-- - Existing documents không bị động tới (petitionId default NULL).

ALTER TABLE "documents" ADD COLUMN "petitionId" TEXT;

CREATE INDEX "documents_petitionId_idx" ON "documents"("petitionId");

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_petitionId_fkey"
  FOREIGN KEY ("petitionId") REFERENCES "petitions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
