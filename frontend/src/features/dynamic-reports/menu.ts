import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

/**
 * Only "Thiết lập báo cáo" (S01) exists so far — PR6 (nhập liệu) and PR8
 * (tình trạng) add their own menu entries in their own PRs once the pages
 * they'd point to actually exist.
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
];
