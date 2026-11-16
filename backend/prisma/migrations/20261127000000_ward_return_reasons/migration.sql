-- The catalogue of reasons PC02 returns a ward unit's request for ("Lý do trả về"), as Directory rows of type
-- LY_DO_TRA_VE. A starting set; administrators edit, add and switch off rows in the directory screens. Idempotent.
INSERT INTO "directories" ("id", "type", "code", "name", "order", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'LY_DO_TRA_VE', 'THIEU_TAI_LIEU', 'Thiếu tài liệu, chứng cứ', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'LY_DO_TRA_VE', 'SAI_THAM_QUYEN', 'Không đúng thẩm quyền', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'LY_DO_TRA_VE', 'THONG_TIN_CHUA_DU', 'Thông tin trình chưa đầy đủ', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'LY_DO_TRA_VE', 'DTV_KHONG_PHU_HOP', 'Điều tra viên đề xuất chưa phù hợp', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'LY_DO_TRA_VE', 'KHAC', 'Lý do khác', 99, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("type", "code") DO NOTHING;
