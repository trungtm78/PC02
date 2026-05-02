import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const reportsMenu: FeatureMenuEntry[] = [
  {
    section: 'reports',
    id: 'reports',
    label: 'Báo cáo & Thống kê',
    icon: 'BarChart3',
    children: [
      { section: 'reports', id: 'reports-export', label: 'Xuất hồ sơ đơn thư', path: '/export-reports' },
      { section: 'reports', id: 'reports-monthly', label: 'Báo cáo tháng', path: '/reports/monthly' },
      { section: 'reports', id: 'reports-quarterly', label: 'Báo cáo quý', path: '/reports/quarterly' },
      { section: 'reports', id: 'reports-district', label: 'Thống kê quận/huyện', path: '/statistics/district' },
      { section: 'reports', id: 'reports-overdue', label: 'Hồ sơ quá hạn', path: '/settings/overdue-records' },
      { section: 'reports', id: 'reports-activity', label: 'Nhật ký hoạt động', path: '/activity-log' },
      { section: 'reports', id: 'reports-tdac', label: 'Báo cáo TĐC', path: '/reports/tdac' },
      { section: 'reports', id: 'reports-stat48', label: 'Thống kê 48 trường', path: '/reports/stat48' },
      { section: 'reports', id: 'reports-phu-luc-1-6', label: 'Phụ lục 1-6 BCA', path: '/reports/phu-luc-1-6' },
    ],
  },
];
