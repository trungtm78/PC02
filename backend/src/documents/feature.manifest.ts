import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const DOCUMENTS_MANIFEST: FeatureManifest = {
  key: 'documents',
  label: 'Tài liệu hồ sơ',
  description: 'Upload + phân loại văn bản hồ sơ vụ án',
  domain: 'case-domain',
  /// E5 — đợt rủi ro trung bình. Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
};
