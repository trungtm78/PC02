import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const EXCHANGES_MANIFEST: FeatureManifest = {
  key: 'exchanges',
  label: 'Trao đổi vụ án',
  description: 'Luân chuyển vụ án giữa các đơn vị',
  domain: 'workflow-domain',
};
