import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';

export const WARD_PATHS = {
  list: '/ho-so-phan-cong',
  create: '/ho-so-phan-cong/new',
  view: (id: string) => `/ho-so-phan-cong/${encodeURIComponent(id)}`,
  edit: (id: string) => `/ho-so-phan-cong/${encodeURIComponent(id)}/edit`,
} as const;

/**
 * Between "Đơn thư" (petitions, order 100) and "Ủy thác điều tra" (order 102): explicit orders, because entries of
 * equal order keep the registration order of the folders and `ward-assignments` sorts after `uy-thac-dieu-tra`.
 */
export const WARD_MENU_ORDER = 101;

export const wardAssignmentsMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'ward-assignments',
    label: L.menu.group,
    icon: 'ClipboardList',
    order: WARD_MENU_ORDER,
    children: [
      { section: 'business', id: 'ward-assignments-list', label: L.menu.list, path: WARD_PATHS.list, quyen: ['read:WardAssignment'] },
      { section: 'business', id: 'ward-assignments-new', label: L.menu.create, path: WARD_PATHS.create, quyen: ['write:WardAssignment'] },
    ],
  },
];
