-- 08/10/2026 — gieo 7 khoá cấu hình "bấm vào dòng danh sách".
--
-- Vì sao bằng migration: `deploy.sh` chỉ chạy `prisma migrate deploy`, không chạy seed settings, còn
-- `SettingsService.updateValue` trả "không tồn tại" cho khoá chưa có dòng — admin sẽ không thấy và không lưu được.
-- Idempotent: ON CONFLICT DO NOTHING giữ nguyên giá trị admin đã đặt nếu migration chạy lại.
INSERT INTO "system_settings" ("id", "key", "value", "label", "updatedAt")
VALUES
  ('cfg_bam_dong_don_thu', 'BAM_DONG_DON_THU', 'KHONG', 'Bấm vào dòng — danh sách Đơn thư', CURRENT_TIMESTAMP),
  ('cfg_bam_dong_don_thu_phuong', 'BAM_DONG_DON_THU_PHUONG', 'KHONG', 'Bấm vào dòng — Đơn thư phường/xã', CURRENT_TIMESTAMP),
  ('cfg_bam_dong_don_trung', 'BAM_DONG_DON_TRUNG', 'KHONG', 'Bấm vào dòng — Đơn trùng', CURRENT_TIMESTAMP),
  ('cfg_bam_dong_vu_viec', 'BAM_DONG_VU_VIEC', 'XEM', 'Bấm vào dòng — danh sách Vụ việc', CURRENT_TIMESTAMP),
  ('cfg_bam_dong_vu_an', 'BAM_DONG_VU_AN', 'XEM', 'Bấm vào dòng — danh sách Vụ án', CURRENT_TIMESTAMP),
  ('cfg_bam_dong_tong_hop', 'BAM_DONG_TONG_HOP', 'XEM', 'Bấm vào dòng — danh sách Tổng hợp', CURRENT_TIMESTAMP),
  ('cfg_bam_dong_uy_thac', 'BAM_DONG_UY_THAC', 'XEM', 'Bấm vào dòng — Uỷ thác điều tra', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
