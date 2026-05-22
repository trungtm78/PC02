import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const AdminUnitsPage = lazy(() => import('@/pages/admin-units/AdminUnitsPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderAdminUnitsRoutes(): ReactElement[] {
  return [
    <Route key="admin-units" path="/don-vi-hanh-chinh" element={wrap(<AdminUnitsPage />)} />,
  ];
}
