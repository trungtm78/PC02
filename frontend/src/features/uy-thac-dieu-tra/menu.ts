import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const uyThacDieuTraMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'uy-thac-dieu-tra',
    label: 'Ủy Thác Điều Tra',
    icon: 'ArrowRightLeft',
    children: [
      { section: 'business', id: 'utdt-list', label: 'Danh sách ủy thác', path: '/uy-thac-dieu-tra' },
    ],
  },
];
