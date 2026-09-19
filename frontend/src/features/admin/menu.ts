import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const adminMenu: FeatureMenuEntry[] = [
  {
    section: 'admin',
    id: 'users',
    label: 'Người dùng',
    path: '/nguoi-dung',
    quyen: ['read:User'],
    icon: 'User',
  },
  {
    section: 'admin',
    id: 'deadline-rules',
    label: 'Quy tắc thời hạn',
    path: '/admin/deadline-rules',
    quyen: ['read:DeadlineRuleVersion'],
    icon: 'ClipboardList',
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
    quyen: ['read:Setting'],
    icon: 'Settings',
  },
  {
    section: 'admin',
    id: 'admin-restore',
    label: 'Khôi phục dữ liệu',
    path: '/admin/khoi-phuc',
    icon: 'RotateCcw',
    // GET cases|incidents|petitions/admin/deleted — trang hiện tab theo từng quyền (#442).
    quyen: ['restore:Case', 'restore:Incident', 'restore:Petition'],
  },
];
