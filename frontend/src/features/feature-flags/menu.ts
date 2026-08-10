import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const featureFlagsMenu: FeatureMenuEntry[] = [
  {
    section: 'admin',
    id: 'feature-flags',
    label: 'Bật/tắt tính năng',
    path: '/admin/tinh-nang',
    icon: 'ToggleRight',
  },
];
