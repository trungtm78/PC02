import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

// F1 swap (v0.56): LawyerListPageShell (PR4 ListPageShell + bulk-delete v0.51).
const LawyerListPage = lazy(() => import('@/pages/lawyers/LawyerListPageShell'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderLawyersRoutes(): ReactElement[] {
  return [
    <Route key="lawyers" path="/lawyers" element={wrap(<LawyerListPage />)} />,
  ];
}
