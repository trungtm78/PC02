import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const UyThacDieuTraListPage = lazy(() => import('./UyThacDieuTraListPage'));
const UyThacDieuTraFormPage = lazy(() => import('./UyThacDieuTraFormPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderUyThacDieuTraRoutes(): ReactElement[] {
  return [
    <Route
      key="utdt-list"
      path="/uy-thac-dieu-tra"
      element={wrap(<UyThacDieuTraListPage />)}
    />,
    <Route
      key="utdt-new"
      path="/uy-thac-dieu-tra/new"
      element={wrap(<UyThacDieuTraFormPage />)}
    />,
    <Route
      key="utdt-edit"
      path="/uy-thac-dieu-tra/:id/edit"
      element={wrap(<UyThacDieuTraFormPage />)}
    />,
  ];
}
