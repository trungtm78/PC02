import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const petitionsMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'petitions',
    label: 'Đơn thư',
    icon: 'FileText',
    children: [
      { section: 'business', id: 'petitions-list', label: 'Danh sách đơn thư', path: '/petitions' },
      { section: 'business', id: 'petitions-new', label: 'Tiếp nhận đơn mới', path: '/petitions/new' },
      // v0.37.1: tool moved from "Phân loại & Quản lý" — fix wrong placement.
      { section: 'business', id: 'petitions-duplicates', label: 'Đơn trùng lặp', path: '/classification/duplicates' },
      // v0.37.1: new page — Đơn thư theo phường/xã (built via PR-WARD-PETITIONS).
      { section: 'business', id: 'petitions-ward', label: 'Đơn thư theo phường/xã', path: '/ward/petitions' },
    ],
  },
];
