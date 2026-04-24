import axios from 'axios';

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
        sessionStorage.setItem('accessToken', data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        // Refresh failed - clear tokens and redirect to login
        sessionStorage.removeItem('accessToken');
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
};
