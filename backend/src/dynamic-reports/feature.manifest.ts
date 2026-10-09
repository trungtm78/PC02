import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const DYNAMIC_REPORTS_MANIFEST: FeatureManifest = {
  key: 'dynamic_reports',
  label: 'Báo cáo động',
  description:
    'Thiết lập báo cáo từ Excel, nhập & tổng hợp theo tổ, theo dõi tình trạng nhập liệu — thay quy trình Excel thủ công.',
  domain: 'reporting-domain',
  permissions: [
    { action: 'read', subject: 'DynamicReport' },
    { action: 'manage', subject: 'DynamicReport' },
    { action: 'admin', subject: 'DynamicReport' },
  ],
};
