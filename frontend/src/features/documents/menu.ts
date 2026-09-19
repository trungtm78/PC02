import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const documentsMenu: FeatureMenuEntry[] = [
  {
    section: 'system',
    id: 'documents',
    label: 'Tài liệu hồ sơ',
    path: '/documents', quyen: ['read:Document'],
    icon: 'FolderOpen',
  },
];
