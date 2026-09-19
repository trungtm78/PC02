import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const calendarMenu: FeatureMenuEntry[] = [
  {
    section: 'system',
    id: 'calendar',
    label: 'Lịch công tác',
    path: '/calendar', quyen: ['read:Calendar'],
    icon: 'Calendar',
  },
];
