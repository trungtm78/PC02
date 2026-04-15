import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const DocumentsPage = lazy(() => import('@/pages/system/DocumentsPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderDocumentsRoutes(): ReactElement[] {
  return [
    <Route key="documents" path="/documents" element={wrap(<DocumentsPage />)} />,
  ];
}
