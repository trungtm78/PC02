import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from '@/pages/auth/LoginPage';
import TwoFaPage from '@/pages/auth/TwoFaPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import FirstLoginChangePasswordPage from '@/pages/auth/FirstLoginChangePasswordPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MainLayout } from '@/layouts/MainLayout';
import { FeatureFlagsProvider, FEATURE_MODULES } from '@/lib/features';
import { useAuthHydration } from '@/hooks/useAuthHydration';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
});

// Compute route elements ONCE at module scope so React Router never sees
// new element identities on re-render. Without this, every App re-render
// (e.g. FeatureFlagsProvider loading) creates new <Route> elements →
// React Router unmounts the active page → user sees blank flash → remount.
const featureRouteElements = FEATURE_MODULES.flatMap((f) => f.renderRoutes());

function App() {
  // Hydrates user profile from /auth/me whenever a token exists without a cached profile.
  // Single source of truth — Login/2FA/refresh only manage tokens.
  useAuthHydration();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/2fa" element={<TwoFaPage />} />
          <Route path="/auth/first-login-change-password" element={<FirstLoginChangePasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected routes under MainLayout — every page below comes
              from a feature module in src/features/*. Adding a new screen
              means creating a new folder there; do NOT add <Route> here.

              Note on flag gating: frontend routes are NOT hidden when a
              feature flag is off. The backend guard returns 404 on API
              calls for disabled features, and `useMenuSections` hides the
              sidebar entry, so users can't navigate there normally. Direct
              URL navigation still mounts the shell, but every API call
              404s. This is intentional — it keeps routing static so
              react-router doesn't remount trees on flag refresh. */}
          <Route
            element={
              <ProtectedRoute>
                <FeatureFlagsProvider>
                  <MainLayout />
                </FeatureFlagsProvider>
              </ProtectedRoute>
            }
          >
            {featureRouteElements}
          </Route>

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
