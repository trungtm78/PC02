import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const KPI_MANIFEST: FeatureManifest = {
  key: 'kpi',
  label: 'Chỉ tiêu KPI',
  description: 'Dashboard 4 chỉ tiêu cứng công tác điều tra theo TT28/2020/TT-BCA',
  domain: 'reporting-domain',
  permissions: [
    { action: 'read', subject: 'Incident' },
  ],
};
