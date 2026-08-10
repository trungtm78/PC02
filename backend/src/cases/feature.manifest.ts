import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const CASES_MANIFEST: FeatureManifest = {
  key: 'cases',
  label: 'Quản lý vụ án',
  description: '15 trạng thái theo BLTTHS 2015 (TT28/2020/TT-BCA)',
  domain: 'case-domain',
  /// E6 — đợt rủi ro CAO. Chỉ MERGE sau khi PR-M1-mobile đã lên production và tỷ lệ APK cũ đủ thấp (ngưỡng chưa ấn định — xem PROGRESS.md). Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
  permissions: [
    { action: 'read', subject: 'Case' },
    { action: 'write', subject: 'Case' },
    { action: 'edit', subject: 'Case' },
    { action: 'delete', subject: 'Case' },
  ],
};
