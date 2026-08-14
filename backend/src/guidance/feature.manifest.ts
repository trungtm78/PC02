import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const GUIDANCE_MANIFEST: FeatureManifest = {
  key: 'guidance',
  label: 'Hướng dẫn nghiệp vụ',
  description: 'Yêu cầu + phản hồi hướng dẫn chuyên môn',
  domain: 'workflow-domain',
  /// E5 — đợt rủi ro trung bình. Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
};
