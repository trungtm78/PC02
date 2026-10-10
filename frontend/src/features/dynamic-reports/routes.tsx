import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const ReportRegisterPage = lazy(
  () => import('@/pages/dynamic-reports/ReportRegisterPage'),
);

export function renderDynamicReportsRoutes(): ReactElement[] {
  return [
    <Route
      key="dynamic-reports-setup"
      path="/bao-cao-dong/thiet-lap"
      element={wrapRoute(<ReportRegisterPage />)}
    />,
  ];
}
