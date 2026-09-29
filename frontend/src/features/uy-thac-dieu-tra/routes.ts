import { createElement, lazy, type ReactElement } from 'react';
import { Route, Navigate, useParams } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const UyThacDieuTraListPage = lazy(() => import('./UyThacDieuTraListPage'));

function RedirectToEdit(): ReactElement {
  const { id } = useParams<{ id: string }>();
  return createElement(Navigate, {
    to: `/cases/${id}/edit?caseProvenance=UY_THAC_DIEU_TRA&returnPath=/uy-thac-dieu-tra`,
    replace: true,
  });
}

export function renderUyThacDieuTraRoutes(): ReactElement[] {
  return [
    createElement(Route, {
      key: 'utdt-list',
      path: '/uy-thac-dieu-tra',
      element: wrapRoute(createElement(UyThacDieuTraListPage)),
    }),
    createElement(Route, {
      key: 'utdt-new',
      path: '/uy-thac-dieu-tra/new',
      element: createElement(Navigate, {
        to: '/cases/new?caseProvenance=UY_THAC_DIEU_TRA&returnPath=/uy-thac-dieu-tra',
        replace: true,
      }),
    }),
    createElement(Route, {
      key: 'utdt-edit',
      path: '/uy-thac-dieu-tra/:id/edit',
      element: createElement(RedirectToEdit),
    }),
  ];
}
