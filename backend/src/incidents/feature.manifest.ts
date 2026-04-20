import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const INCIDENTS_MANIFEST: FeatureManifest = {
  key: 'incidents',
  label: 'Vụ việc (BCA)',
  description: 'Quản lý vụ việc 4 giai đoạn theo TT28/2020/TT-BCA',
  domain: 'petition-domain',
  permissions: [
    { action: 'read', subject: 'Incident' },
    { action: 'write', subject: 'Incident' },
    { action: 'edit', subject: 'Incident' },
    { action: 'delete', subject: 'Incident' },
  ],
};
