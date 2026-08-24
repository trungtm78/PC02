import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const DirectoriesPage = lazy(() => import('@/pages/directories/DirectoriesPage'));


export function renderDirectoryRoutes(): ReactElement[] {
  return [
    <Route key="directory" path="/danh-muc" element={wrapRoute(<DirectoriesPage />)} />,
  ];
}
