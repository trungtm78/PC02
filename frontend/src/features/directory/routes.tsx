import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const DirectoriesPage = lazy(() => import('@/pages/directories/DirectoriesPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderDirectoryRoutes(): ReactElement[] {
  return [
    <Route key="directory" path="/danh-muc" element={wrap(<DirectoriesPage />)} />,
  ];
}
