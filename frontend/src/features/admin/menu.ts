import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const adminMenu: FeatureMenuEntry[] = [
  {
    section: 'admin',
    id: 'users',
    label: 'Người dùng',
    path: '/nguoi-dung',
    icon: 'User',
  },
  {
    section: 'admin',
    id: 'admin-settings',
    label: 'Cấu hình admin',
    path: '/admin/settings',
    icon: 'Settings',
  },
];
