import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const ADMIN_MANIFEST: FeatureManifest = {
  key: 'admin',
  label: 'Quản trị hệ thống',
  description: 'User management + cấu hình chung',
  domain: 'core',
};
