import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const INCIDENTS_MANIFEST: FeatureManifest = {
  key: 'incidents',
  label: 'Vụ việc (BCA)',
  description: 'Quản lý vụ việc 4 giai đoạn theo TT28/2020/TT-BCA',
  domain: 'petition-domain',
  /// E6 — đợt rủi ro CAO. Chỉ MERGE sau khi PR-M1-mobile đã lên production và tỷ lệ APK cũ đủ thấp (ngưỡng chưa ấn định — xem PROGRESS.md). Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
  permissions: [
    { action: 'read', subject: 'Incident' },
    { action: 'write', subject: 'Incident' },
    { action: 'edit', subject: 'Incident' },
    { action: 'delete', subject: 'Incident' },
  ],
};
