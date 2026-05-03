/**
 * Wire-format snapshot for SETTINGS_KEY values.
 *
 * Every value here is a primary key in the `system_settings` DB table (seeded
 * by `settings.service.ts#seed()`). Renaming a value silently disables the
 * feature gated by it — most consequentially, `TWO_FA_ENABLED` rename = 2FA
 * bypass for every user.
 *
 * This test pins the values. Adding a new setting? Add a row + a `toBe()`.
 * Renaming? Coordinate a migration on the existing DB rows first.
 */

import { SETTINGS_KEY } from './settings-keys.constants';

describe('SETTINGS_KEY wire format', () => {
  it('TWO_FA_ENABLED is "TWO_FA_ENABLED" — must match seeded DB row exactly', () => {
    expect(SETTINGS_KEY.TWO_FA_ENABLED).toBe('TWO_FA_ENABLED');
  });

  it.each([
    ['THOI_HAN_XAC_MINH', 'THOI_HAN_XAC_MINH'],
    ['THOI_HAN_GIA_HAN_1', 'THOI_HAN_GIA_HAN_1'],
    ['THOI_HAN_GIA_HAN_2', 'THOI_HAN_GIA_HAN_2'],
    ['THOI_HAN_TOI_DA', 'THOI_HAN_TOI_DA'],
    ['THOI_HAN_PHUC_HOI', 'THOI_HAN_PHUC_HOI'],
    ['THOI_HAN_PHAN_LOAI', 'THOI_HAN_PHAN_LOAI'],
    ['SO_LAN_GIA_HAN_TOI_DA', 'SO_LAN_GIA_HAN_TOI_DA'],
    ['THOI_HAN_GUI_QD_VKS', 'THOI_HAN_GUI_QD_VKS'],
    ['THOI_HAN_TO_CAO', 'THOI_HAN_TO_CAO'],
    ['THOI_HAN_KHIEU_NAI', 'THOI_HAN_KHIEU_NAI'],
    ['THOI_HAN_KIEN_NGHI', 'THOI_HAN_KIEN_NGHI'],
    ['THOI_HAN_PHAN_ANH', 'THOI_HAN_PHAN_ANH'],
    ['CANH_BAO_SAP_HAN', 'CANH_BAO_SAP_HAN'],
    ['THOI_HAN_XOA_VU_VIEC', 'THOI_HAN_XOA_VU_VIEC'],
  ] as const)('%s key value is %s', (key, expected) => {
    expect(SETTINGS_KEY[key]).toBe(expected);
  });

  it('every key matches its value — guards against typos like KEY: "KEY_TYPO"', () => {
    for (const [key, value] of Object.entries(SETTINGS_KEY)) {
      expect(value).toBe(key);
    }
  });
});
