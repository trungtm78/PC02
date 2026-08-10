import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const REPORTS_MANIFEST: FeatureManifest = {
  key: 'reports',
  label: 'Báo cáo',
  description:
    'Báo cáo tháng/quý/năm + thống kê phường/xã (cải cách hành chính 2025)',
  domain: 'reporting-domain',
  /// E6 — đợt rủi ro CAO. Chỉ MERGE sau khi PR-M1-mobile đã lên production và tỷ lệ APK cũ đủ thấp (ngưỡng chưa ấn định — xem PROGRESS.md). Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
};
