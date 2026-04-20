import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const MasterClassPage = lazy(() => import('@/pages/admin/MasterClassPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderMasterClassRoutes(): ReactElement[] {
  return [
    <Route key="master-class" path="/phan-loai" element={wrap(<MasterClassPage />)} />,
  ];
}
