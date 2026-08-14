import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

// ND-22: the flag says the module is part of this deployment; `requires` says
// this user may open the screen. Both must be true. Entries the seed defines no
// subject for stay flag-only — a grant to check would have to be invented.


export const petitionsMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'petitions',
    label: 'Đơn thư',
    icon: 'FileText',
    children: [
      { section: 'business', id: 'petitions-list', label: 'Danh sách đơn thư', path: '/petitions', requires: { resource: 'petitions' } },
      { section: 'business', id: 'petitions-new', label: 'Tiếp nhận đơn mới', path: '/petitions/new', requires: { resource: 'petitions', action: 'create' } },
      // v0.37.1: tool moved from "Phân loại & Quản lý" — fix wrong placement.
      { section: 'business', id: 'petitions-duplicates', label: 'Đơn trùng lặp', path: '/classification/duplicates', requires: { resource: 'petitions' } },
      // v0.37.1: new page — Đơn thư theo phường/xã (built via PR-WARD-PETITIONS).
      { section: 'business', id: 'petitions-ward', label: 'Đơn thư theo phường/xã', path: '/ward/petitions', requires: { resource: 'petitions' } },
    ],
  },
];
