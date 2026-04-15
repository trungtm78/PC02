import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const UserManagementPage = lazy(() => import('@/pages/users/UserManagementPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderAdminRoutes(): ReactElement[] {
  return [
    <Route key="users" path="/nguoi-dung" element={wrap(<UserManagementPage />)} />,
    <Route key="admin-settings" path="/admin/settings" element={wrap(<AdminSettingsPage />)} />,
  ];
}
