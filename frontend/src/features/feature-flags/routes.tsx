import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const FeatureFlagsAdminPage = lazy(
  () => import('@/pages/admin/FeatureFlagsAdminPage'),
);

export function renderFeatureFlagsRoutes(): ReactElement[] {
  return [
    <Route
      key="admin-feature-flags"
      path="/admin/tinh-nang"
      element={
        <Suspense fallback={null}>
          <FeatureFlagsAdminPage />
        </Suspense>
      }
    />,
  ];
}
