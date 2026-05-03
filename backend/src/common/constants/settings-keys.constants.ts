/**
 * SystemSetting keys — DB WIRE FORMAT.
 *
 * Values are PRIMARY KEYs in the `system_settings` table. The seed in
 * `settings.service.ts#seed()` and runtime lookups via `getValue(key)` both
 * use these strings. Renaming a value WILL cause `getValue()` to return null
 * and silently disable the feature gated by it. Most consequential cases:
 *
 *   - `TWO_FA_ENABLED` rename → 2FA enforcement bypass for all users
 *   - `THOI_HAN_*` rename → deadline calculator falls back to defaults
 *
 * Add new settings by appending and seeding a row; never rename.
 */
export const SETTINGS_KEY = {
  TWO_FA_ENABLED: 'TWO_FA_ENABLED',

  // BLTTHS 2015 deadlines (Đ.146-149)
  THOI_HAN_XAC_MINH: 'THOI_HAN_XAC_MINH',
  THOI_HAN_GIA_HAN_1: 'THOI_HAN_GIA_HAN_1',
  THOI_HAN_GIA_HAN_2: 'THOI_HAN_GIA_HAN_2',
  THOI_HAN_TOI_DA: 'THOI_HAN_TOI_DA',
  THOI_HAN_PHUC_HOI: 'THOI_HAN_PHUC_HOI',
  THOI_HAN_PHAN_LOAI: 'THOI_HAN_PHAN_LOAI',
  SO_LAN_GIA_HAN_TOI_DA: 'SO_LAN_GIA_HAN_TOI_DA',
  THOI_HAN_GUI_QD_VKS: 'THOI_HAN_GUI_QD_VKS',

  // Luật Tố cáo / Khiếu nại deadlines
  THOI_HAN_TO_CAO: 'THOI_HAN_TO_CAO',
  THOI_HAN_KHIEU_NAI: 'THOI_HAN_KHIEU_NAI',
  THOI_HAN_KIEN_NGHI: 'THOI_HAN_KIEN_NGHI',
  THOI_HAN_PHAN_ANH: 'THOI_HAN_PHAN_ANH',

  // Ops thresholds
  CANH_BAO_SAP_HAN: 'CANH_BAO_SAP_HAN',
  THOI_HAN_XOA_VU_VIEC: 'THOI_HAN_XOA_VU_VIEC',
} as const;

export type SettingsKey = (typeof SETTINGS_KEY)[keyof typeof SETTINGS_KEY];
