import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const classificationMenu: FeatureMenuEntry[] = [
  {
    section: 'workflow',
    id: 'classification',
    label: 'Phân loại & Quản lý',
    icon: 'FolderKanban',
    children: [
      // v0.37.1: 3 items lạc chỗ moved to correct entity menus (cases, incidents, petitions).
      // Routes unchanged — only menu position. Bookmarks won't break.
      { section: 'workflow', id: 'classification-prosecutor', label: 'Đề xuất VKS', path: '/prosecutor-proposal' },
      { section: 'workflow', id: 'classification-others', label: 'Phân loại khác', path: '/classification/others' },
    ],
  },
];
