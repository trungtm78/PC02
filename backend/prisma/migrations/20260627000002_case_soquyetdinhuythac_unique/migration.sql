-- Unique soQuyetDinhUyThac (Mẫu 58) trên cases.
-- Dedup TRƯỚC khi thêm unique (an toàn cả prod): bản trùng (non-null) được nối '-dup-<id>',
-- giữ nguyên bản có id nhỏ nhất mỗi nhóm. NULL được phép trùng (chuẩn PG, NULLS DISTINCT).
UPDATE "cases" c
SET "so_quyet_dinh_uy_thac" = c."so_quyet_dinh_uy_thac" || '-dup-' || c.id
WHERE c."so_quyet_dinh_uy_thac" IS NOT NULL
  AND c.id <> (
    SELECT MIN(c2.id) FROM "cases" c2
    WHERE c2."so_quyet_dinh_uy_thac" = c."so_quyet_dinh_uy_thac"
  );

-- CreateIndex
CREATE UNIQUE INDEX "cases_so_quyet_dinh_uy_thac_key" ON "cases"("so_quyet_dinh_uy_thac");
