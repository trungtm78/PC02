import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';
// ND-22: the flag says the module is part of this deployment; `requires` says
// this user may open the screen. Every report screen reads the same
// `Report` subject on the backend, so they all answer to `reports`.


export const reportsMenu: FeatureMenuEntry[] = [
  {
    section: 'reports',
    id: 'reports',
    label: 'Báo cáo & Thống kê',
    icon: 'BarChart3',
    children: [
      { section: 'reports', id: 'reports-export', label: 'Xuất hồ sơ đơn thư', path: '/export-reports', requires: { resource: 'reports' } },
      { section: 'reports', id: 'reports-monthly', label: 'Báo cáo tháng', path: '/reports/monthly', requires: { resource: 'reports' } },
      { section: 'reports', id: 'reports-quarterly', label: 'Báo cáo quý', path: '/reports/quarterly', requires: { resource: 'reports' } },
      { section: 'reports', id: 'reports-district', label: 'Thống kê phường/xã', path: '/statistics/district', requires: { resource: 'reports' } },
      { section: 'reports', id: 'reports-overdue', label: 'Hồ sơ quá hạn', path: '/settings/overdue-records', requires: { resource: 'reports' } },
      { section: 'reports', id: 'reports-activity', label: 'Nhật ký hoạt động', path: '/activity-log', requires: { resource: 'reports' } },
      { section: 'reports', id: 'reports-tdac', label: 'Báo cáo TĐC', path: '/reports/tdac', requires: { resource: 'reports' } },
      { section: 'reports', id: 'reports-stat48', label: 'Thống kê 48 trường', path: '/reports/stat48', requires: { resource: 'reports' } },
      { section: 'reports', id: 'reports-phu-luc-1-6', label: 'Phụ lục 1-6 BCA', path: '/reports/phu-luc-1-6', requires: { resource: 'reports' } },
    ],
  },
];
