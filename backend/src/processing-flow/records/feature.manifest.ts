import type { FeatureManifest } from '../../feature-flags/feature-manifest';

/**
 * The steps of a flow on each record (which step is open, its deadline, the actions on it). Nothing reads this switch
 * yet: it is declared with the configuration so that the row exists, OFF, before the code that depends on it ships
 * (inserted disabled by the migration `proc_flow_config`).
 */
export const PROCESSING_FLOW_RECORDS_MANIFEST: FeatureManifest = {
  key: 'processing_flow_records',
  label: 'Quy trình xử lý trên hồ sơ',
  description: 'Các bước xử lý, hạn từng bước và thao tác theo quy trình trên từng đơn thư, vụ việc, vụ án',
  domain: 'workflow-domain',
};
