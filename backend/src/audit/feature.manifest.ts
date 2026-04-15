import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const AUDIT_MANIFEST: FeatureManifest = {
  key: 'audit',
  label: 'Nhật ký hệ thống',
  description: 'Audit log toàn bộ hoạt động người dùng',
  domain: 'core',
};
