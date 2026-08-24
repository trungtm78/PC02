import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const ExportReportsPage = lazy(() => import('@/pages/reports/ExportReportsPage'));
const ActivityLogPage = lazy(() => import('@/pages/reports/ActivityLogPage'));
const OverdueRecordsPage = lazy(() => import('@/pages/reports/OverdueRecordsPage'));
const DistrictStatisticsPage = lazy(() => import('@/pages/reports/DistrictStatisticsPage'));
const MonthlyReportPage = lazy(() => import('@/pages/reports/MonthlyReportPage'));
const QuarterlyReportPage = lazy(() => import('@/pages/reports/QuarterlyReportPage'));
const TdacReportPage = lazy(() => import('@/pages/reports/TdacReportPage'));
const TdacDraftsPage = lazy(() => import('@/pages/reports/TdacDraftsPage'));
const TdacDraftDetailPage = lazy(() => import('@/pages/reports/TdacDraftDetailPage'));
const Stat48ReportPage = lazy(() => import('@/pages/reports/Stat48ReportPage'));
const PhuLuc16Page = lazy(() => import('@/pages/reports/PhuLuc16Page'));


export function renderReportsRoutes(): ReactElement[] {
  return [
    <Route key="reports-export" path="/export-reports" element={wrapRoute(<ExportReportsPage />)} />,
    <Route key="reports-monthly" path="/reports/monthly" element={wrapRoute(<MonthlyReportPage />)} />,
    <Route key="reports-quarterly" path="/reports/quarterly" element={wrapRoute(<QuarterlyReportPage />)} />,
    <Route key="reports-district" path="/statistics/district" element={wrapRoute(<DistrictStatisticsPage />)} />,
    <Route key="reports-overdue" path="/settings/overdue-records" element={wrapRoute(<OverdueRecordsPage />)} />,
    <Route key="reports-activity" path="/activity-log" element={wrapRoute(<ActivityLogPage />)} />,
    <Route key="reports-tdac" path="/reports/tdac" element={wrapRoute(<TdacReportPage />)} />,
    <Route key="reports-tdac-drafts" path="/reports/tdac/drafts" element={wrapRoute(<TdacDraftsPage />)} />,
    <Route key="reports-tdac-draft-detail" path="/reports/tdac/drafts/:id" element={wrapRoute(<TdacDraftDetailPage />)} />,
    <Route key="reports-stat48" path="/reports/stat48" element={wrapRoute(<Stat48ReportPage />)} />,
    <Route key="reports-phu-luc-1-6" path="/reports/phu-luc-1-6" element={wrapRoute(<PhuLuc16Page />)} />,
  ];
}
