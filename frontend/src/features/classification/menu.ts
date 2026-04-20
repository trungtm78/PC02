import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const classificationMenu: FeatureMenuEntry[] = [
  {
    section: 'workflow',
    id: 'classification',
    label: 'Phân loại & Quản lý',
    icon: 'FolderKanban',
    children: [
      { section: 'workflow', id: 'classification-ward-cases', label: 'Vụ án theo phường/xã', path: '/ward/cases' },
      { section: 'workflow', id: 'classification-ward-incidents', label: 'Vụ việc theo phường/xã', path: '/ward/incidents' },
      { section: 'workflow', id: 'classification-prosecutor', label: 'Đề xuất VKS', path: '/prosecutor-proposal' },
      { section: 'workflow', id: 'classification-duplicates', label: 'Đơn trùng lặp', path: '/classification/duplicates' },
      { section: 'workflow', id: 'classification-others', label: 'Phân loại khác', path: '/classification/others' },
    ],
  },
];
