import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const DELEGATIONS_MANIFEST: FeatureManifest = {
  key: 'delegations',
  label: 'Ủy quyền điều tra',
  description: 'Phân công điều tra viên xử lý vụ án',
  domain: 'workflow-domain',
};
