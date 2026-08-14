import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

// ND-22: the flag says the module is part of this deployment; `requires` says
// this user may open the screen. Both must be true. Entries the seed defines no
// subject for stay flag-only — a grant to check would have to be invented.


export const calendarMenu: FeatureMenuEntry[] = [
  {
    section: 'system',
    id: 'calendar',
    label: 'Lịch công tác',
    path: '/calendar',
    icon: 'Calendar',
    requires: { resource: 'calendar' },
  },
];
