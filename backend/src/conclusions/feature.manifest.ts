import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const CONCLUSIONS_MANIFEST: FeatureManifest = {
  key: 'conclusions',
  label: 'Kết luận điều tra',
  description: 'Kết luận điều tra gửi VKS',
  domain: 'petition-domain',
  /// E5 — đợt rủi ro trung bình. Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
};
