import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

// ND-22: the flag says the module is part of this deployment; `requires` says
// this user may open the screen. Both must be true. Entries the seed defines no
// subject for stay flag-only — a grant to check would have to be invented.


export const adminMenu: FeatureMenuEntry[] = [
  {
    section: 'admin',
    id: 'users',
    label: 'Người dùng',
    path: '/nguoi-dung',
    icon: 'User',
    requires: { resource: 'users' },
  },
  {
    section: 'admin',
    id: 'deadline-rules',
    label: 'Quy tắc thời hạn',
    path: '/admin/deadline-rules',
    icon: 'ClipboardList',
    requires: { resource: 'settings' },
  },
  {
    section: 'admin',
    id: 'legacy-migration',
    label: 'Di trú dữ liệu cũ',
    path: '/admin/di-tru-du-lieu',
    icon: 'Database',
  },
  {
    section: 'admin',
    id: 'admin-settings',
    label: 'Cấu hình admin',
    path: '/admin/settings',
    icon: 'Settings',
    requires: { resource: 'settings' },
  },
  {
    section: 'admin',
    id: 'admin-restore',
    label: 'Khôi phục dữ liệu',
    path: '/admin/khoi-phuc',
    icon: 'RotateCcw',
  },
];
