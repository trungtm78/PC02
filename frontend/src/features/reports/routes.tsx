import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const ExportReportsPage = lazy(() => import('@/pages/reports/ExportReportsPage'));
const ActivityLogPage = lazy(() => import('@/pages/reports/ActivityLogPage'));
const OverdueRecordsPage = lazy(() => import('@/pages/reports/OverdueRecordsPage'));
const DistrictStatisticsPage = lazy(() => import('@/pages/reports/DistrictStatisticsPage'));
const MonthlyReportPage = lazy(() => import('@/pages/reports/MonthlyReportPage'));
const QuarterlyReportPage = lazy(() => import('@/pages/reports/QuarterlyReportPage'));
const TdacReportPage = lazy(() => import('@/pages/reports/TdacReportPage'));
const TdacDraftsPage = lazy(() => import('@/pages/reports/TdacDraftsPage'));
const TdacDraftDetailPage = lazy(() => import('@/pages/reports/TdacDraftDetailPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderReportsRoutes(): ReactElement[] {
  return [
    <Route key="reports-export" path="/export-reports" element={wrap(<ExportReportsPage />)} />,
    <Route key="reports-monthly" path="/reports/monthly" element={wrap(<MonthlyReportPage />)} />,
    <Route key="reports-quarterly" path="/reports/quarterly" element={wrap(<QuarterlyReportPage />)} />,
    <Route key="reports-district" path="/statistics/district" element={wrap(<DistrictStatisticsPage />)} />,
    <Route key="reports-overdue" path="/settings/overdue-records" element={wrap(<OverdueRecordsPage />)} />,
    <Route key="reports-activity" path="/activity-log" element={wrap(<ActivityLogPage />)} />,
    <Route key="reports-tdac" path="/reports/tdac" element={wrap(<TdacReportPage />)} />,
    <Route key="reports-tdac-drafts" path="/reports/tdac/drafts" element={wrap(<TdacDraftsPage />)} />,
    <Route key="reports-tdac-draft-detail" path="/reports/tdac/drafts/:id" element={wrap(<TdacDraftDetailPage />)} />,
  ];
}
