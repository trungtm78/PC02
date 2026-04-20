import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const REPORTS_MANIFEST: FeatureManifest = {
  key: 'reports',
  label: 'Báo cáo',
  description: 'Báo cáo tháng/quý/năm + thống kê quận/huyện',
  domain: 'reporting-domain',
};
