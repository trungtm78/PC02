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
    const isAuthEndpoint = (original?.url ?? '').includes('/auth/');
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
export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string; expiresIn: string }>(
      '/auth/login',
      { username, password },
    ),
  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string }>('/auth/refresh', { refreshToken }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ success: boolean; message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    }),
};
