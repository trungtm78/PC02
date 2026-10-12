import type { FeatureManifest } from '../../feature-flags/feature-manifest';

/**
 * Emergency switch for the Excel-like grid of the dynamic reports (entry, team view, aggregate, wizard).
 *
 * The screens read this flag the "ON unless an admin turns it off" way (`useFeatureBatMacDinh`): the grid is the
 * default, and turning the flag off brings the plain list back for everyone, with no deploy. Everything the grid
 * shows is also available in the list, and the server never depends on which of the two a client uses.
 */
export const DYNAMIC_REPORTS_GRID_MANIFEST: FeatureManifest = {
  key: 'dynamic_reports_grid',
  label: 'Báo cáo động: dạng lưới',
  description:
    'Nhập và xem số liệu báo cáo động trên lưới giống file Excel mẫu (tắt → mọi màn trở lại dạng danh sách)',
  domain: 'reporting-domain',
};
