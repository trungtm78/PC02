import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const EditWindowRequestsPage = lazy(
  () => import('@/pages/admin/edit-window-requests/EditWindowRequestsPage'),
);

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderEditWindowRequestsRoutes(): ReactElement[] {
  return [
    <Route
      key="edit-window-requests"
      path="/admin/yeu-cau-reset"
      element={wrap(<EditWindowRequestsPage />)}
    />,
  ];
}
