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
    // Token đã hỏi lại vì hồ sơ đệm thiếu `permissions` — chỉ hỏi MỘT lần mỗi token, không lặp vô hạn nếu máy chủ
    // vẫn không trả (setProfile phát sự kiện đổi token → hydrate chạy lại).
    let daHoiLaiChoToken: string | null = null;
    // Mỗi lần ứng dụng NẠP (kể cả F5) hỏi lại /auth/me một lần dù đã có hồ sơ đệm: hồ sơ nằm ở sessionStorage nên
    // sống qua F5, mà thanh bên + nút ẩn/hiện theo `permissions` trong đó — quản trị đổi quyền vai trò thì cán bộ phải
    // thấy ngay ở lần tải lại, không phải chờ đăng nhập lại (rà mã PR #443, 20/09/2026).
    let daLamMoiLanNap = false;

    async function hydrate() {
      const token = authStore.getAccessToken();
      const profile = authStore.getProfile();
      if (!token) return;
      if (profile) {
        // Hồ sơ đệm từ trước #435 không có `permissions` → hỏi lại một lần mỗi token (rà mã PR #442).
        const thieuQuyen = !Array.isArray(profile.permissions) && daHoiLaiChoToken !== token;
        if (daLamMoiLanNap && !thieuQuyen) return;
        daHoiLaiChoToken = token;
      }
      daLamMoiLanNap = true;

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
