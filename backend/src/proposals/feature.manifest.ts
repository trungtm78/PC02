import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const PROPOSALS_MANIFEST: FeatureManifest = {
  key: 'proposals',
  label: 'Đề xuất khởi tố',
  description: 'Đề xuất gửi VKS phê chuẩn',
  domain: 'workflow-domain',
  /// E5 — đợt rủi ro trung bình. Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
};
