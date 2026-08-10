import type { FeatureManifest } from '../feature-flags/feature-manifest';

/**
 * Trả hồ sơ cho đơn vị chuyển đến. Nằm dưới nhóm "Quy trình xử lý" trên giao
 * diện nhưng có controller riêng, nên có cờ riêng để bật/tắt độc lập.
 */
export const RECORD_RETURNS_MANIFEST: FeatureManifest = {
  key: 'record-returns',
  label: 'Trả hồ sơ',
  description: 'Trả vụ án / vụ việc / đơn thư về đơn vị đã chuyển đến',
  domain: 'workflow-domain',
};
