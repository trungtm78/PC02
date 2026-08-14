import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const PETITIONS_MANIFEST: FeatureManifest = {
  key: 'petitions',
  label: 'Đơn thư',
  description: 'Tiếp nhận đơn thư + chuyển đổi đơn → vụ án',
  domain: 'petition-domain',
  /// E6 — đợt rủi ro CAO. Chỉ MERGE sau khi PR-M1-mobile đã lên production và tỷ lệ APK cũ đủ thấp (ngưỡng chưa ấn định — xem PROGRESS.md). Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
  permissions: [
    { action: 'read', subject: 'Petition' },
    { action: 'write', subject: 'Petition' },
    { action: 'edit', subject: 'Petition' },
    { action: 'delete', subject: 'Petition' },
  ],
};
