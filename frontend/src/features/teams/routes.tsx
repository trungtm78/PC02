import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const TeamsPage = lazy(() => import('@/pages/admin/TeamsPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderTeamsRoutes(): ReactElement[] {
  return [
    <Route key="teams" path="/to-nhom" element={wrap(<TeamsPage />)} />,
  ];
}
