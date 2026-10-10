import type { FeatureModuleManifest } from '@/lib/features/moduleTypes';

export const dynamicReportsManifest: FeatureModuleManifest = {
  key: 'dynamic_reports',
  label: 'Báo cáo động',
  description: 'Thiết lập báo cáo từ Excel, nhập & tổng hợp theo tổ, theo dõi tình trạng nhập liệu',
  domain: 'reporting-domain',
  icon: 'FileSpreadsheet',
};
