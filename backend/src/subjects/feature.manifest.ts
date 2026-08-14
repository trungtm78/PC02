import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const SUBJECTS_MANIFEST: FeatureManifest = {
  key: 'subjects',
  label: 'Đối tượng liên quan',
  description: 'Nghi phạm, bị hại, nhân chứng',
  domain: 'case-domain',
  /// E5 — đợt rủi ro trung bình. Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
};
