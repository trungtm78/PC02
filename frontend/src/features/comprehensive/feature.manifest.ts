import type { FeatureModuleManifest } from '@/lib/features/moduleTypes';

// v0.37.1: cross-entity views feature (split from "cases" feature)
export const comprehensiveManifest: FeatureModuleManifest = {
  key: 'comprehensive',
  label: 'Tổng hợp',
  description: 'Danh sách tổng hợp + Hồ sơ mới tiếp nhận — view chung Case/Incident/Petition',
  domain: 'case-domain',
  icon: 'LayoutDashboard',
};
