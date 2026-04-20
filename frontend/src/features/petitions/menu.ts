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
    ],
  },
];
