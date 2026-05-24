import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

// v0.37.1: NEW menu "Tổng hợp" for cross-entity views.
// Moved from "Quản lý vụ án" menu — these items query all 3 entities (Case + Incident + Petition).
// v0.37.2.2: order=10 to surface above 'cases' (default 100) in section 'business'.
export const comprehensiveMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'comprehensive',
    label: 'Tổng hợp',
    icon: 'LayoutDashboard',
    order: 10,
    children: [
      { section: 'business', id: 'comprehensive-list', label: 'Danh sách tổng hợp', path: '/comprehensive-list' },
      { section: 'business', id: 'comprehensive-initial', label: 'Hồ sơ mới tiếp nhận', path: '/initial-cases' },
      { section: 'business', id: 'journey', label: 'Hành Trình Hồ Sơ', path: '/journey' },
    ],
  },
];
