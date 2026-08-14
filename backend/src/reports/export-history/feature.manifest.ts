import type { FeatureManifest } from '../../feature-flags/feature-manifest';

/** D7/D8 — lịch sử xuất báo cáo, bật/tắt độc lập với nhóm báo cáo. */
export const REPORT_EXPORT_HISTORY_MANIFEST: FeatureManifest = {
  key: 'report-export-history',
  label: 'Lịch sử xuất báo cáo',
  description: 'Ai đã xuất báo cáo nào, lúc nào, cho kỳ nào',
  domain: 'reporting-domain',
};
