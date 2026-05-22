import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const casesMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'cases',
    label: 'Quản lý vụ án',
    icon: 'Briefcase',
    children: [
      { section: 'business', id: 'cases-list', label: 'Danh sách vụ án', path: '/cases' },
      // v0.37.1: route now canonical /cases/new (legacy /add-new-record redirects).
      { section: 'business', id: 'cases-new', label: 'Khởi tố vụ án mới', path: '/cases/new' },
      // v0.37.1: filter view moved from "Phân loại & Quản lý" — fix wrong placement.
      { section: 'business', id: 'cases-ward', label: 'Vụ án theo phường/xã', path: '/ward/cases' },
      // v0.37.1: 2 cross-entity items moved to NEW "Tổng hợp" menu — see features/comprehensive/menu.ts
    ],
  },
];
