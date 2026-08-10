import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

// ND-22: the flag says the module is part of this deployment; `requires` says
// this user may open the screen. Both must be true. Entries the seed defines no
// subject for stay flag-only — a grant to check would have to be invented.


export const incidentsMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'incidents',
    label: 'Vụ việc',
    icon: 'FileWarning',
    children: [
      { section: 'business', id: 'incidents-list', label: 'Danh sách vụ việc', path: '/vu-viec', requires: { resource: 'incidents' } },
      { section: 'business', id: 'incidents-new', label: 'Thêm vụ việc mới', path: '/vu-viec/new', requires: { resource: 'incidents', action: 'create' } },
      // v0.37.1: filter view moved from "Phân loại & Quản lý" — fix wrong placement.
      { section: 'business', id: 'incidents-ward', label: 'Vụ việc theo phường/xã', path: '/ward/incidents', requires: { resource: 'incidents' } },
    ],
  },
];
