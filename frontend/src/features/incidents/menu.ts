import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const incidentsMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'incidents',
    label: 'Vụ việc',
    icon: 'FileWarning',
    children: [
      { section: 'business', id: 'incidents-list', label: 'Danh sách vụ việc', path: '/vu-viec' },
      { section: 'business', id: 'incidents-new', label: 'Thêm vụ việc mới', path: '/vu-viec/new' },
      // v0.37.1: filter view moved from "Phân loại & Quản lý" — fix wrong placement.
      { section: 'business', id: 'incidents-ward', label: 'Vụ việc theo phường/xã', path: '/ward/incidents' },
    ],
  },
];
