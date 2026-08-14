import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const INVESTIGATION_SUPPLEMENTS_MANIFEST: FeatureManifest = {
  key: 'investigation-supplements',
  label: 'Bổ sung điều tra',
  description: 'Yêu cầu bổ sung điều tra từ VKS',
  domain: 'petition-domain',
  /// E5 — đợt rủi ro trung bình. Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
};
