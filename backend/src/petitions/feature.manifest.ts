import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const PETITIONS_MANIFEST: FeatureManifest = {
  key: 'petitions',
  label: 'Đơn thư',
  description: 'Tiếp nhận đơn thư + chuyển đổi đơn → vụ án',
  domain: 'petition-domain',
  permissions: [
    { action: 'read', subject: 'Petition' },
    { action: 'write', subject: 'Petition' },
    { action: 'edit', subject: 'Petition' },
    { action: 'delete', subject: 'Petition' },
  ],
};
