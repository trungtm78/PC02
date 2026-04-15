import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderDashboardRoutes(): ReactElement[] {
  return [
    <Route
      key="dashboard"
      path="/dashboard"
      element={wrap(<DashboardPage />)}
    />,
  ];
}
