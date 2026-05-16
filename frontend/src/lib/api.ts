import axios from 'axios';
import type { AuthUser } from '@/stores/auth.store';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request UNLESS the caller already set
// Authorization (per-request bearer for pending-token flows: 2FA, first-login
// change-password). Codex challenge #5 fix — without this guard, stale
// sessionStorage tokens silently overwrote the changePasswordToken /
// twoFaToken and the backend guard rejected with 401.
api.interceptors.request.use((config) => {
  if (config.headers.Authorization) return config;
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
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/change-password') ||
      url.includes('/auth/first-login-change-password') ||
      url.includes('/auth/2fa');
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
// D1: when user must change password on first login (after admin create or admin reset).
export type ChangePasswordPending = {
  pending: true;
  changePasswordToken: string;
  reason: 'MUST_CHANGE_PASSWORD';
};
export type LoginResponse = LoginSuccess | TwoFaPending | ChangePasswordPending;

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
  // D1: first-login forced change. Token is the change_password_pending JWT from
  // the login response (or 2FA verify response). On success the backend returns
  // a real LoginSuccess TokenPair — user is fully logged in.
  firstLoginChangePassword: (changePasswordToken: string, newPassword: string) =>
    api.post<LoginSuccess>(
      '/auth/first-login-change-password',
      { newPassword },
      { headers: { Authorization: `Bearer ${changePasswordToken}` } },
    ),
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

  // Magic link enrollment (post-/autoplan): user click link → POST với
  // uid+token+newPassword → backend issue real TokenPair (NIST compliant,
  // single-use, 72h TTL).
  enroll: (uid: string, token: string, newPassword: string) =>
    api.post<LoginSuccess>('/auth/enroll', { uid, token, newPassword }),

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

// ─── Calendar Events v2 API ───────────────────────────────────────────────────

export type EventScope = 'SYSTEM' | 'TEAM' | 'PERSONAL';
export type ReminderChannel = 'FCM' | 'EMAIL';

export type EventCategory = {
  id: string;
  slug: string;
  name: string;
  color: string;
  icon: string | null;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryPayload = {
  slug: string;
  name: string;
  color: string;
  icon?: string;
  sortOrder?: number;
};

export type UpdateCategoryPayload = Partial<Omit<CreateCategoryPayload, 'slug'>>;

export const eventCategoriesApi = {
  list: () => api.get<EventCategory[]>('/event-categories'),
  get: (id: string) => api.get<EventCategory>(`/event-categories/${id}`),
  create: (payload: CreateCategoryPayload) => api.post<EventCategory>('/event-categories', payload),
  update: (id: string, payload: UpdateCategoryPayload) => api.patch<EventCategory>(`/event-categories/${id}`, payload),
  remove: (id: string) => api.delete(`/event-categories/${id}`),
};

export type CalendarEvent = {
  id: string;
  title: string;
  shortTitle: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  isOfficialDayOff: boolean;
  lunarDate: string | null;
  categoryId: string;
  category?: EventCategory;
  scope: EventScope;
  teamId: string | null;
  userId: string | null;
  recurrenceRule: string | null;
  recurrenceEndDate: string | null;
  createdById: string;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateEventPayload = {
  title: string;
  shortTitle?: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  startTime?: string; // HH:MM
  endTime?: string;
  allDay: boolean;
  isOfficialDayOff?: boolean;
  lunarDate?: string;
  categoryId: string;
  scope: EventScope;
  teamId?: string;
  recurrenceRule?: string;
  recurrenceEndDate?: string;
};

export type UpdateEventPayload = Partial<CreateEventPayload>;

export const calendarEventsApi = {
  list: (year: number, month?: number) => {
    const params = new URLSearchParams({ year: String(year) });
    if (month !== undefined) params.set('month', String(month));
    return api.get<CalendarEvent[]>(`/calendar-events?${params}`);
  },
  create: (payload: CreateEventPayload) => api.post<CalendarEvent>('/calendar-events', payload),
  update: (id: string, payload: UpdateEventPayload) => api.patch<CalendarEvent>(`/calendar-events/${id}`, payload),
  remove: (id: string) => api.delete(`/calendar-events/${id}`),
  excludeOccurrence: (id: string, date: string) => api.delete(`/calendar-events/${id}/occurrence/${date}`),
};

export type EventReminder = {
  id: string;
  eventId: string;
  userId: string;
  minutesBefore: number;
  channels: ReminderChannel[];
  createdAt: string;
};

export type CreateReminderPayload = {
  minutesBefore: number;
  channels: ReminderChannel[];
};

export const eventRemindersApi = {
  list: (eventId: string) => api.get<EventReminder[]>(`/events/${eventId}/reminders`),
  create: (eventId: string, payload: CreateReminderPayload) =>
    api.post<EventReminder>(`/events/${eventId}/reminders`, payload),
  remove: (eventId: string, reminderId: string) =>
    api.delete(`/events/${eventId}/reminders/${reminderId}`),
};
