import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const DELEGATIONS_MANIFEST: FeatureManifest = {
  key: 'delegations',
  label: 'Ủy quyền điều tra',
  description: 'Phân công điều tra viên xử lý vụ án',
  domain: 'workflow-domain',
  /// E5 — đợt rủi ro trung bình. Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
};
