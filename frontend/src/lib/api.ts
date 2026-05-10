import axios from 'axios';
import type { AuthUser } from '@/stores/auth.store';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401 (skip auth endpoints to avoid redirect loops)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    const url = original?.url ?? '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/change-password') || url.includes('/auth/2fa');
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await api.post('/auth/refresh', { refreshToken });
        // Update sessionStorage AND notify subscribers (useAuthHydration may need to re-fetch profile)
        sessionStorage.setItem('accessToken', data.accessToken);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pc02:auth-token-changed'));
        }
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        // Refresh failed - clear tokens and redirect to login
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('authProfile');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// Auth API
export type LoginSuccess = { accessToken: string; refreshToken: string; expiresIn: string };
export type TwoFaPending = { pending: true; twoFaToken: string };
export type LoginResponse = LoginSuccess | TwoFaPending;

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }),
  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string }>('/auth/refresh', { refreshToken }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ success: boolean; message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    }),
  // 2FA — second factor step (uses twoFaToken, not accessToken)
  sendEmailOtp: (twoFaToken: string) =>
    api.post<{ success: boolean }>(
      '/auth/2fa/send-email-otp',
      {},
      { headers: { Authorization: `Bearer ${twoFaToken}` } },
    ),
  verifyTwoFa: (twoFaToken: string, code: string, method: 'totp' | 'email_otp' | 'backup') =>
    api.post<LoginSuccess>(
      '/auth/2fa/verify',
      { code, method },
      { headers: { Authorization: `Bearer ${twoFaToken}` } },
    ),
  // 2FA — self-service setup (uses accessToken, must be authenticated)
  setupTotp: () =>
    api.post<{ qrCodeDataUrl: string; backupCodes: string[] }>('/auth/2fa/setup'),
  verifySetup: (token: string) =>
    api.post<{ success: boolean }>('/auth/2fa/verify-setup', { token }),
  disableTotp: () =>
    api.delete<{ success: boolean }>('/auth/2fa/disable'),

  // Forgot / reset password
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),

  resetPassword: (email: string, otp: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/reset-password', { email, otp, newPassword }),

  // Returns the authenticated user's profile + team membership.
  // FE forms use this for "create" mode pre-fill (current user, primary team).
  me: () => api.get<AuthUser>('/auth/me'),
};

// ─── Abbreviations API ────────────────────────────────────────────────────────

export type Abbreviation = {
  id: string;
  shortcut: string;
  expansion: string;
  createdAt: string;
  updatedAt: string;
};

export type AbbreviationUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

// ─── User Shortcuts API ────────────────────────────────────────────────────────

export type UserShortcut = {
  id: string;
  action: string;
  binding: string;
  createdAt: string;
  updatedAt: string;
};

export const userShortcutsApi = {
  list: () => api.get<UserShortcut[]>('/user-shortcuts'),
  upsert: (action: string, binding: string) =>
    api.put<UserShortcut>(`/user-shortcuts/${encodeURIComponent(action)}`, { binding }),
  remove: (action: string) => api.delete(`/user-shortcuts/${encodeURIComponent(action)}`),
  resetAll: () => api.post<{ deleted: number }>('/user-shortcuts/reset'),
  swap: (fromAction: string, toAction: string) =>
    api.post<{ success: boolean; from: { action: string; binding: string }; to: { action: string; binding: string } }>(
      '/user-shortcuts/swap',
      { fromAction, toAction },
    ),
};

export const abbreviationsApi = {
  list: () => api.get<Abbreviation[]>('/abbreviations'),
  upsert: (shortcut: string, expansion: string) =>
    api.put<Abbreviation>(`/abbreviations/${encodeURIComponent(shortcut)}`, {
      shortcut,
      expansion,
    }),
  remove: (shortcut: string) => api.delete(`/abbreviations/${encodeURIComponent(shortcut)}`),
  copyFrom: (sourceUserId: string, replace = false) =>
    api.post<{ copied: number }>('/abbreviations/copy', { sourceUserId, replace }),
  listUsers: () => api.get<AbbreviationUser[]>('/abbreviations/users'),
};
