import type { FeatureManifest } from '../feature-flags/feature-manifest';

// v0.37.2.1: backend manifest mirror frontend features/comprehensive. Required
// so seedFeatureFlags() creates a feature_flags row → useMenuSections hook
// shows the "Tổng hợp" menu group (Danh sách tổng hợp + Hồ sơ mới tiếp nhận).
// No backend module/controller — cross-entity views call existing /cases,
// /incidents, /petitions endpoints and merge client-side.
export const COMPREHENSIVE_MANIFEST: FeatureManifest = {
  key: 'comprehensive',
  label: 'Tổng hợp',
  description:
    'Danh sách tổng hợp + Hồ sơ mới tiếp nhận — view chung Case/Incident/Petition',
  domain: 'case-domain',
};
