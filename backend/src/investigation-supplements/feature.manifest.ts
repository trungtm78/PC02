import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const INVESTIGATION_SUPPLEMENTS_MANIFEST: FeatureManifest = {
  key: 'investigation-supplements',
  label: 'Bổ sung điều tra',
  description: 'Yêu cầu bổ sung điều tra từ VKS',
  domain: 'petition-domain',
};
