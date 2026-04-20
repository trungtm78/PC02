import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const DOCUMENTS_MANIFEST: FeatureManifest = {
  key: 'documents',
  label: 'Tài liệu hồ sơ',
  description: 'Upload + phân loại văn bản hồ sơ vụ án',
  domain: 'case-domain',
};
