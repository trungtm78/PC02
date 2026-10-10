import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const ReportRegisterPage = lazy(
  () => import('@/pages/dynamic-reports/ReportRegisterPage'),
);
const ReportTemplateUploadPage = lazy(
  () => import('@/pages/dynamic-reports/ReportTemplateUploadPage'),
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
  ];
}
