import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';
import { permissions } from '@/locales/permissions.vi';
import { PAGE_PATH, SCREEN_PERMISSION } from '@/features/permissions/types';

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
    id: 'admin-permissions',
    label: permissions.menuLabel,
    path: PAGE_PATH,
    // GET /authz/catalogue, /authz/templates, /authz/teams: all `read:Role`.
    quyen: [SCREEN_PERMISSION.READ],
    icon: 'Shield',
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
    id: 'admin-llm-config',
    label: 'Cấu hình LLM',
    path: '/admin/cau-hinh-llm',
    quyen: ['read:LlmConfig'],
    icon: 'Settings',
  },
  {
    section: 'admin',
    id: 'admin-ocr-quality',
    label: 'Chất lượng đọc ảnh scan',
    path: '/admin/chat-luong-ocr',
    quyen: ['read:OcrQuality'],
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
