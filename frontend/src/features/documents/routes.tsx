import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const DocumentsPage = lazy(() => import('@/pages/system/DocumentsPage'));


export function renderDocumentsRoutes(): ReactElement[] {
  return [
    <Route key="documents" path="/documents" element={wrapRoute(<DocumentsPage />)} />,
  ];
}
