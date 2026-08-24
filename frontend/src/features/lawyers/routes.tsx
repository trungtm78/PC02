import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

// F1 swap (v0.56): LawyerListPageShell (PR4 ListPageShell + bulk-delete v0.51).
const LawyerListPage = lazy(() => import('@/pages/lawyers/LawyerListPageShell'));


export function renderLawyersRoutes(): ReactElement[] {
  return [
    <Route key="lawyers" path="/lawyers" element={wrapRoute(<LawyerListPage />)} />,
  ];
}
