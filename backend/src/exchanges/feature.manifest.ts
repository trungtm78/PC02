import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const EXCHANGES_MANIFEST: FeatureManifest = {
  key: 'exchanges',
  label: 'Trao đổi vụ án',
  description: 'Luân chuyển vụ án giữa các đơn vị',
  domain: 'workflow-domain',
  /// E5 — đợt rủi ro trung bình. Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
};
