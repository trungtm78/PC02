import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const LAWYERS_MANIFEST: FeatureManifest = {
  key: 'lawyers',
  label: 'Luật sư',
  description: 'Danh sách luật sư bào chữa',
  domain: 'case-domain',
  /// E4 — đợt rủi ro thấp. Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
};
