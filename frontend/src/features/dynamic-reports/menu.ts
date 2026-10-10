import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

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
  {
    section: 'reports',
    id: 'dynamic-reports-status',
    label: 'Tình trạng nhập liệu',
    icon: 'Table2',
    path: '/bao-cao-dong/tinh-trang',
    quyen: ['read:DynamicReport'],
  },
];
