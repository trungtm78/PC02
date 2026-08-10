import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

// ND-22: the flag says the module is part of this deployment; `requires` says
// this user may open the screen. Both must be true. Entries the seed defines no
// subject for stay flag-only — a grant to check would have to be invented.


export const subjectsMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'subjects',
    label: 'Đối tượng liên quan',
    icon: 'UsersRound',
    order: 101,
    children: [
      { section: 'business', id: 'subjects-objects', label: 'Danh sách đối tượng', path: '/objects', requires: { resource: 'objects' } },
      { section: 'business', id: 'subjects-suspects', label: 'Nghi phạm', path: '/people/suspects', requires: { resource: 'objects' } },
      { section: 'business', id: 'subjects-victims', label: 'Bị hại', path: '/people/victims', requires: { resource: 'objects' } },
      { section: 'business', id: 'subjects-witnesses', label: 'Nhân chứng', path: '/people/witnesses', requires: { resource: 'objects' } },
      // v0.37.1 USER OVERRIDE: Luật sư moved from top-level to child here per PC02
      // user mental model (cán bộ điều tra xem Luật sư cùng nhóm các bên tham gia tố tụng).
      // Codex + Claude subagent flagged as category error (defense counsel vs subject of
      // investigation) but anh confirmed override based on domain context.
      { section: 'business', id: 'subjects-lawyers', label: 'Luật sư', path: '/lawyers', requires: { resource: 'lawyers' } },
    ],
  },
];
