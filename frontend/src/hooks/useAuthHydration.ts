import { useEffect } from 'react';
import { authStore, AUTH_TOKEN_EVENT, layChuToken } from '@/stores/auth.store';
import { authApi } from '@/lib/api';

/**
 * Centralized auth profile hydration.
 *
 * Watches for token changes (login, 2FA, refresh) and ensures the user profile
 * is fetched from /auth/me whenever an access token exists without a cached
 * profile. Single entry point — Login/2FA/refresh interceptor only manage tokens.
 *
 * Mounted once at the app root (App.tsx). Forms read profile via authStore.getProfile().
 */
export function useAuthHydration() {
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const token = authStore.getAccessToken();
      const profile = authStore.getProfile();
      if (!token || profile) return;

      try {
        const { data } = await authApi.me();
        if (cancelled) return;
        // Chỉ ghi khi hồ sơ là của CHỦ token hiện hành: /me của tài khoản A về muộn sau khi B đã đăng nhập trong cùng
        // tab thì bỏ — nếu không hồ sơ A ghi đè phiên của B (rà mã PR #435, 19/09/2026).
        const tokenHienHanh = authStore.getAccessToken();
        if (!tokenHienHanh || layChuToken(tokenHienHanh) !== data.id) return;
        authStore.setProfile(data);
      } catch {
        // Network/server error — leave profile null. Forms degrade gracefully
        // (defaults stay empty until next hydration attempt). 401 is handled
        // by the global response interceptor, which clears tokens and redirects.
      }
    }

    hydrate();
    const unsubscribe = authStore.onTokenChanged(() => {
      hydrate();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
}

export const __INTERNAL__ = { AUTH_TOKEN_EVENT };
