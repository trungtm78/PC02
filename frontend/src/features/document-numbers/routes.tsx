import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const DocumentNumberSettingsPage = lazy(() => import('./pages/DocumentNumberSettingsPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderDocumentNumbersRoutes(): ReactElement[] {
  return [
    <Route
      key="document-numbers"
      path="/settings/document-numbers"
      element={wrap(<DocumentNumberSettingsPage />)}
    />,
  ];
}
