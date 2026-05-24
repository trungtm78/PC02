import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const JOURNEY_MANIFEST: FeatureManifest = {
  key: 'journey',
  label: 'Hành trình hồ sơ',
  description: 'Timeline toàn diện cho Vụ việc, Vụ án, Đơn thư',
  domain: 'case-domain',
  permissions: [
    { action: 'read', subject: 'Case' },
    { action: 'read', subject: 'Petition' },
    { action: 'read', subject: 'Incident' },
  ],
};
