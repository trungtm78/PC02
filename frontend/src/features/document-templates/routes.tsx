import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const DocumentTemplatesPage = lazy(() => import('./pages/DocumentTemplatesPage'));


export function renderDocumentTemplatesRoutes(): ReactElement[] {
  return [
    <Route
      key="document-templates"
      path="/settings/document-templates"
      element={wrapRoute(<DocumentTemplatesPage />)}
    />,
  ];
}
