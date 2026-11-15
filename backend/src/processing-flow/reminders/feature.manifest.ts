import type { FeatureManifest } from '../../feature-flags/feature-manifest';

/**
 * Reminders and escalations by step of a flow. Nothing reads this switch yet: it is declared with the configuration so
 * that the row exists, OFF, before the code that depends on it ships (inserted disabled by the migration
 * `proc_flow_config`).
 */
export const PROCESSING_FLOW_REMINDERS_MANIFEST: FeatureManifest = {
  key: 'processing_flow_reminders',
  label: 'Nhắc hạn theo quy trình',
  description: 'Nhắc hạn và báo cáo vượt cấp theo từng bước của quy trình xử lý',
  domain: 'workflow-domain',
  defaultEnabled: false,
};
