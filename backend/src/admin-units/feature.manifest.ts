import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const ADMIN_UNITS_MANIFEST: FeatureManifest = {
  key: 'admin-units',
  label: 'Đơn vị hành chính',
  description: 'Read-only browser Tỉnh/Phường + signed dataset versioning (v0.34.0.0)',
  domain: 'org-domain',
  permissions: [
    // v0.34a: no special perms — all authenticated users can read.
    // v0.34b sẽ add ADMIN-gated abolish queue permissions.
  ],
};
