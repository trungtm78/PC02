import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const TeamsPage = lazy(() => import('@/pages/admin/TeamsPage'));


export function renderTeamsRoutes(): ReactElement[] {
  return [
    <Route key="teams" path="/to-nhom" element={wrapRoute(<TeamsPage />)} />,
  ];
}
