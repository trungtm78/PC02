import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const casesMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'cases',
    label: 'Quản lý vụ án',
    icon: 'Briefcase',
    children: [
      { section: 'business', id: 'cases-list', label: 'Danh sách vụ án', path: '/cases' },
      { section: 'business', id: 'cases-new', label: 'Thêm mới hồ sơ', path: '/add-new-record' },
      { section: 'business', id: 'cases-comprehensive', label: 'Danh sách tổng hợp', path: '/comprehensive-list' },
      { section: 'business', id: 'cases-initial', label: 'Hồ sơ tiếp nhận', path: '/initial-cases' },
    ],
  },
];
