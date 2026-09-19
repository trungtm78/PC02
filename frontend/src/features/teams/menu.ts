import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const teamsMenu: FeatureMenuEntry[] = [
  {
    section: 'admin',
    id: 'teams',
    label: 'Tổ/Đội công tác',
    path: '/to-nhom',
    quyen: ['read:Team'],
    icon: 'Users',
  },
];
