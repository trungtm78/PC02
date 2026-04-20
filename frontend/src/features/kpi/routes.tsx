import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const KpiDashboardPage = lazy(() => import('@/pages/kpi/KpiDashboardPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderKpiRoutes(): ReactElement[] {
  return [
    <Route key="kpi-dashboard" path="/kpi" element={wrap(<KpiDashboardPage />)} />,
  ];
}
