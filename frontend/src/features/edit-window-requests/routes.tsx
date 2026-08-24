import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const EditWindowRequestsPage = lazy(
  () => import('@/pages/admin/edit-window-requests/EditWindowRequestsPage'),
);


export function renderEditWindowRequestsRoutes(): ReactElement[] {
  return [
    <Route
      key="edit-window-requests"
      path="/admin/yeu-cau-reset"
      element={wrapRoute(<EditWindowRequestsPage />)}
    />,
  ];
}
