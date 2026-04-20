import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderSettingsRoutes(): ReactElement[] {
  return [
    <Route key="settings" path="/settings" element={wrap(<SettingsPage />)} />,
  ];
}
