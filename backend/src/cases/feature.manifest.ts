import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const CASES_MANIFEST: FeatureManifest = {
  key: 'cases',
  label: 'Quản lý vụ án',
  description: '15 trạng thái theo BLTTHS 2015 (TT28/2020/TT-BCA)',
  domain: 'case-domain',
  permissions: [
    { action: 'read', subject: 'Case' },
    { action: 'write', subject: 'Case' },
    { action: 'edit', subject: 'Case' },
    { action: 'delete', subject: 'Case' },
  ],
};
