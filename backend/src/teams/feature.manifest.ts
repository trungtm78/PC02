import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const TEAMS_MANIFEST: FeatureManifest = {
  key: 'teams',
  label: 'Tổ/Đội công tác',
  description: 'Tổ chức đơn vị + phân quyền theo tổ',
  domain: 'org-domain',
  /// E6 — đợt rủi ro CAO. Chỉ MERGE sau khi PR-M1-mobile đã lên production và tỷ lệ APK cũ đủ thấp (ngưỡng chưa ấn định — xem PROGRESS.md). Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
  permissions: [
    { action: 'read', subject: 'Team' },
    { action: 'write', subject: 'Team' },
    { action: 'edit', subject: 'Team' },
    { action: 'delete', subject: 'Team' },
  ],
};
