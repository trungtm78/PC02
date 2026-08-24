import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));


export function renderSettingsRoutes(): ReactElement[] {
  return [
    <Route key="settings" path="/settings" element={wrapRoute(<SettingsPage />)} />,
  ];
}
