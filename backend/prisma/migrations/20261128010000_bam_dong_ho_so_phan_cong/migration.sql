-- The row-click setting of the list "Hồ sơ phân công phường/xã" (the eighth screen of `giao-dien.constants.ts`).
-- Seeded here because the deploy does not run the settings seed. Default KHONG, as the petition lists: officers
-- select text on the list to copy it. Idempotent: a value an administrator has set is kept.
INSERT INTO "system_settings" ("id", "key", "value", "label", "updatedAt")
VALUES
  ('cfg_bam_dong_ho_so_phan_cong', 'BAM_DONG_HO_SO_PHAN_CONG', 'KHONG', 'Bấm vào dòng — Hồ sơ phân công phường/xã', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
