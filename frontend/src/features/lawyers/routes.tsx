import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const LawyerListPage = lazy(() => import('@/pages/lawyers/LawyerListPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderLawyersRoutes(): ReactElement[] {
  return [
    <Route key="lawyers" path="/lawyers" element={wrap(<LawyerListPage />)} />,
  ];
}
