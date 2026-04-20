import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const NOTIFICATIONS_MANIFEST: FeatureManifest = {
  key: 'notifications',
  label: 'Thông báo',
  description: 'Push + in-app notification',
  domain: 'core',
};
