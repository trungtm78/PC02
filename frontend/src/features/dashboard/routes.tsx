import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));


export function renderDashboardRoutes(): ReactElement[] {
  return [
    <Route
      key="dashboard"
      path="/dashboard"
      element={wrapRoute(<DashboardPage />)}
    />,
  ];
}
