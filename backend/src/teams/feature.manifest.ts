import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const TEAMS_MANIFEST: FeatureManifest = {
  key: 'teams',
  label: 'Tổ/Đội công tác',
  description: 'Tổ chức đơn vị + phân quyền theo tổ',
  domain: 'org-domain',
  permissions: [
    { action: 'read', subject: 'Team' },
    { action: 'write', subject: 'Team' },
    { action: 'edit', subject: 'Team' },
    { action: 'delete', subject: 'Team' },
  ],
};
