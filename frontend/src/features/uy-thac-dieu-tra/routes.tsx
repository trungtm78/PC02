import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const UyThacDieuTraListPage = lazy(() => import('./UyThacDieuTraListPage'));

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
  ];
}
