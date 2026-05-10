/**
 * Auth store using localStorage for refresh token persistence
 * and sessionStorage for access token (tab-scoped security).
 *
 * Profile (id, teams, primaryTeam) is fetched via GET /auth/me after
 * setTokens and cached in sessionStorage. JWT only carries email/role/canDispatch.
 */

const PROFILE_KEY = 'authProfile';
const TOKEN_EVENT = 'pc02:auth-token-changed';

export interface AuthTeam {
  teamId: string;
  teamName: string;
  isLeader: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  canDispatch?: boolean;
  teams: AuthTeam[];
  primaryTeam: { teamId: string; teamName: string } | null;
}

/** Minimal subset decoded from JWT — used as fallback when profile not yet hydrated. */
export interface JwtAuthUser {
  email: string;
  role: string;
  canDispatch?: boolean;
}

function parseJwtPayload(token: string): JwtAuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      email: payload.email as string,
      role: payload.role as string,
      canDispatch: payload.canDispatch === true,
    };
  } catch {
    return null;
  }
}

function dispatchTokenChanged() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(TOKEN_EVENT));
  }
}

export const authStore = {
  setTokens(accessToken: string, refreshToken: string) {
    sessionStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    dispatchTokenChanged();
  },

  clearTokens() {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem('refreshToken');
    dispatchTokenChanged();
  },

  getAccessToken(): string | null {
    return sessionStorage.getItem('accessToken');
  },

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  },

  setProfile(profile: AuthUser) {
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    dispatchTokenChanged();
  },

  getProfile(): AuthUser | null {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  /**
   * Returns the cached AuthUser profile if available; otherwise falls back to
   * a minimal subset decoded from the JWT (id-less). Forms that rely on
   * `id`/`teams`/`primaryTeam` MUST gate on `getProfile()` (not getUser()).
   */
  getUser(): AuthUser | JwtAuthUser | null {
    const profile = this.getProfile();
    if (profile) return profile;
    const token = this.getAccessToken();
    if (!token) return null;
    return parseJwtPayload(token);
  },

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },

  /** Subscribe to token/profile changes. Returns an unsubscribe function. */
  onTokenChanged(handler: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener(TOKEN_EVENT, handler);
    return () => window.removeEventListener(TOKEN_EVENT, handler);
  },
};

export const AUTH_TOKEN_EVENT = TOKEN_EVENT;
