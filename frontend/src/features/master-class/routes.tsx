import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const MasterClassPage = lazy(() => import('@/pages/admin/MasterClassPage'));


export function renderMasterClassRoutes(): ReactElement[] {
  return [
    <Route key="master-class" path="/phan-loai" element={wrapRoute(<MasterClassPage />)} />,
  ];
}
