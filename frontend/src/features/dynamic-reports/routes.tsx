import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const ReportRegisterPage = lazy(
  () => import('@/pages/dynamic-reports/ReportRegisterPage'),
);
const ReportTemplateUploadPage = lazy(
  () => import('@/pages/dynamic-reports/ReportTemplateUploadPage'),
);
const ReportInputRegisterPage = lazy(
  () => import('@/pages/dynamic-reports/ReportInputRegisterPage'),
);
const SubmissionInputPage = lazy(
  () => import('@/pages/dynamic-reports/SubmissionInputPage'),
);
const ReportManagerListPage = lazy(
  () => import('@/pages/dynamic-reports/ReportManagerListPage'),
);
const ReportSubmissionReviewPage = lazy(
  () => import('@/pages/dynamic-reports/ReportSubmissionReviewPage'),
);
const ReportPeriodSummaryPage = lazy(
  () => import('@/pages/dynamic-reports/ReportPeriodSummaryPage'),
);
const UnlockRequestQueuePage = lazy(
  () => import('@/pages/dynamic-reports/UnlockRequestQueuePage'),
);
const ReportHistoryPage = lazy(
  () => import('@/pages/dynamic-reports/ReportHistoryPage'),
);

export function renderDynamicReportsRoutes(): ReactElement[] {
  return [
    <Route
      key="dynamic-reports-setup"
      path="/bao-cao-dong/thiet-lap"
      element={wrapRoute(<ReportRegisterPage />)}
    />,
    <Route
      key="dynamic-reports-new"
      path="/bao-cao-dong/thiet-lap/moi"
      element={wrapRoute(<ReportTemplateUploadPage />)}
    />,
    <Route
      key="dynamic-reports-input"
      path="/bao-cao-dong/nhap"
      element={wrapRoute(<ReportInputRegisterPage />)}
    />,
    <Route
      key="dynamic-reports-input-assignment"
      path="/bao-cao-dong/nhap/:assignmentId"
      element={wrapRoute(<SubmissionInputPage />)}
    />,
    <Route
      key="dynamic-reports-review"
      path="/bao-cao-dong/duyet"
      element={wrapRoute(<ReportManagerListPage />)}
    />,
    <Route
      key="dynamic-reports-review-assignment"
      path="/bao-cao-dong/duyet/:assignmentId"
      element={wrapRoute(<ReportSubmissionReviewPage />)}
    />,
    <Route
      key="dynamic-reports-period-summary"
      path="/bao-cao-dong/duyet/tong-hop/:periodId"
      element={wrapRoute(<ReportPeriodSummaryPage />)}
    />,
    <Route
      key="dynamic-reports-period-history"
      path="/bao-cao-dong/duyet/tong-hop/:periodId/lich-su"
      element={wrapRoute(<ReportHistoryPage />)}
    />,
    <Route
      key="dynamic-reports-unlock-requests"
      path="/bao-cao-dong/duyet/mo-khoa"
      element={wrapRoute(<UnlockRequestQueuePage />)}
    />,
  ];
}
