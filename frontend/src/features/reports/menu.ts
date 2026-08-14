import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';
// ND-22: the flag says the module is part of this deployment; `requires` says
// this user may open the screen — and it has to name the grant the endpoint
// behind that screen actually checks, not the one its title suggests.
//
// Every report READ endpoint is `read:Case` (reports.controller.ts,
// tdac.controller.ts, phu-luc-1-6.controller.ts). `read:Report` is not used
// for reading at all — `Report` appears only on TDAC write/approve. The
// activity log is the one exception: `read:AuditLog`. Naming `reports` for
// all nine would have hidden the whole menu from a case reader who holds no
// Report grant, and shown 403 links to anyone who holds one.


export const reportsMenu: FeatureMenuEntry[] = [
  {
    section: 'reports',
    id: 'reports',
    label: 'Báo cáo & Thống kê',
    icon: 'BarChart3',
    children: [
      { section: 'reports', id: 'reports-export', label: 'Xuất hồ sơ đơn thư', path: '/export-reports', requires: { resource: 'petitions' } },
      { section: 'reports', id: 'reports-monthly', label: 'Báo cáo tháng', path: '/reports/monthly', requires: { resource: 'cases' } },
      { section: 'reports', id: 'reports-quarterly', label: 'Báo cáo quý', path: '/reports/quarterly', requires: { resource: 'cases' } },
      { section: 'reports', id: 'reports-district', label: 'Thống kê phường/xã', path: '/statistics/district', requires: { resource: 'cases' } },
      { section: 'reports', id: 'reports-overdue', label: 'Hồ sơ quá hạn', path: '/settings/overdue-records', requires: { resource: 'cases' } },
      { section: 'reports', id: 'reports-activity', label: 'Nhật ký hoạt động', path: '/activity-log', requires: { resource: 'audit-logs' } },
      { section: 'reports', id: 'reports-tdac', label: 'Báo cáo TĐC', path: '/reports/tdac', requires: { resource: 'cases' } },
      { section: 'reports', id: 'reports-stat48', label: 'Thống kê 48 trường', path: '/reports/stat48', requires: { resource: 'cases' } },
      { section: 'reports', id: 'reports-phu-luc-1-6', label: 'Phụ lục 1-6 BCA', path: '/reports/phu-luc-1-6', requires: { resource: 'cases' } },
    ],
  },
];
