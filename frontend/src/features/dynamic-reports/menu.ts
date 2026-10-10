import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

/**
 * PR8 (tình trạng nhập liệu) adds its own menu entry once that page
 * exists.
 */
export const dynamicReportsMenu: FeatureMenuEntry[] = [
  {
    section: 'reports',
    id: 'dynamic-reports-setup',
    label: 'Thiết lập báo cáo',
    icon: 'FileSpreadsheet',
    path: '/bao-cao-dong/thiet-lap',
    quyen: ['manage:DynamicReport'],
  },
  {
    section: 'reports',
    id: 'dynamic-reports-input',
    label: 'Nhập & tổng hợp',
    icon: 'ClipboardList',
    path: '/bao-cao-dong/nhap',
    quyen: ['read:DynamicReport'],
  },
  {
    section: 'reports',
    id: 'dynamic-reports-review',
    label: 'Duyệt báo cáo',
    icon: 'FileCheck',
    path: '/bao-cao-dong/duyet',
    quyen: ['read:DynamicReport'],
  },
];
