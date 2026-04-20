import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const subjectsMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'subjects',
    label: 'Đối tượng liên quan',
    icon: 'UsersRound',
    children: [
      { section: 'business', id: 'subjects-objects', label: 'Danh sách đối tượng', path: '/objects' },
      { section: 'business', id: 'subjects-suspects', label: 'Nghi phạm', path: '/people/suspects' },
      { section: 'business', id: 'subjects-victims', label: 'Bị hại', path: '/people/victims' },
      { section: 'business', id: 'subjects-witnesses', label: 'Nhân chứng', path: '/people/witnesses' },
    ],
  },
];
