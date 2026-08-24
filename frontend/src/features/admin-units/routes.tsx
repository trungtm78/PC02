import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const AdminUnitsPage = lazy(() => import('@/pages/admin-units/AdminUnitsPage'));


export function renderAdminUnitsRoutes(): ReactElement[] {
  return [
    <Route key="admin-units" path="/don-vi-hanh-chinh" element={wrapRoute(<AdminUnitsPage />)} />,
  ];
}
