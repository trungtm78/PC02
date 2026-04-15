import type { FeatureManifest } from '../feature-flags/feature-manifest';

/**
 * Virtual feature — no controller of its own. Groups the frontend pages
 * under "Phân loại & Quản lý" (ward/cases, ward/incidents, prosecutor
 * proposal, duplicate/other classification).
 */
export const CLASSIFICATION_MANIFEST: FeatureManifest = {
  key: 'classification',
  label: 'Phân loại & Quản lý',
  description: 'Phân loại hồ sơ theo xã/phường + trùng lặp',
  domain: 'petition-domain',
};
