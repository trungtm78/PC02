import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const uyThacDieuTraMenu: FeatureMenuEntry[] = [
  {
    section: 'business',
    id: 'uy-thac-dieu-tra',
    label: 'Ủy Thác Điều Tra',
    icon: 'ArrowRightLeft',
    children: [
      { section: 'business', id: 'utdt-list', label: 'Danh sách ủy thác', path: '/uy-thac-dieu-tra' },
      { section: 'business', id: 'utdt-new', label: 'Nhập ủy thác mới', path: '/uy-thac-dieu-tra/new' },
    ],
  },
];
