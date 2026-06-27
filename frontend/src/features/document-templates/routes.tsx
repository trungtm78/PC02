import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const DocumentTemplatesPage = lazy(() => import('./pages/DocumentTemplatesPage'));

const wrap = (node: ReactElement): ReactElement => <Suspense fallback={null}>{node}</Suspense>;

export function renderDocumentTemplatesRoutes(): ReactElement[] {
  return [
    <Route
      key="document-templates"
      path="/settings/document-templates"
      element={wrap(<DocumentTemplatesPage />)}
    />,
  ];
}
