import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const LAWYERS_MANIFEST: FeatureManifest = {
  key: 'lawyers',
  label: 'Luật sư',
  description: 'Danh sách luật sư bào chữa',
  domain: 'case-domain',
};
