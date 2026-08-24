import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const DocumentNumberSettingsPage = lazy(() => import('./pages/DocumentNumberSettingsPage'));


export function renderDocumentNumbersRoutes(): ReactElement[] {
  return [
    <Route
      key="document-numbers"
      path="/settings/document-numbers"
      element={wrapRoute(<DocumentNumberSettingsPage />)}
    />,
  ];
}
