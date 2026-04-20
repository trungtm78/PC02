import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const AUTH_MANIFEST: FeatureManifest = {
  key: 'auth',
  label: 'Xác thực & Phân quyền',
  description: 'Đăng nhập, JWT, RBAC vai trò + quyền',
  domain: 'core',
};
