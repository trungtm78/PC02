import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const KpiDashboardPage = lazy(() => import('@/pages/kpi/KpiDashboardPage'));


export function renderKpiRoutes(): ReactElement[] {
  return [
    <Route key="kpi-dashboard" path="/kpi" element={wrapRoute(<KpiDashboardPage />)} />,
  ];
}
