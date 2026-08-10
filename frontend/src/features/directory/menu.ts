import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

// ND-22: the flag says the module is part of this deployment; `requires` says
// this user may open the screen. Both must be true. Entries the seed defines no
// subject for stay flag-only — a grant to check would have to be invented.


export const directoryMenu: FeatureMenuEntry[] = [
  {
    section: 'system',
    id: 'directory',
    label: 'Danh mục tra cứu',
    path: '/danh-muc',
    icon: 'FolderTree',
    requires: { resource: 'directories' },
  },
];
