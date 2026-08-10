import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const KPI_MANIFEST: FeatureManifest = {
  key: 'kpi',
  label: 'Chỉ tiêu KPI',
  description: 'Dashboard 4 chỉ tiêu cứng công tác điều tra theo TT28/2020/TT-BCA',
  domain: 'reporting-domain',
  /// E4 — đợt rủi ro thấp. Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
  permissions: [
    { action: 'read', subject: 'Incident' },
  ],
};
