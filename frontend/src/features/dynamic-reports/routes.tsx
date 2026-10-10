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
  ];
}
