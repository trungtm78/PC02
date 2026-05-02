import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const REPORTS_MANIFEST: FeatureManifest = {
  key: 'reports',
  label: 'Báo cáo',
  description: 'Báo cáo tháng/quý/năm + thống kê phường/xã (cải cách hành chính 2025)',
  domain: 'reporting-domain',
};
