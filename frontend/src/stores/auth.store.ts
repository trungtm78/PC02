/**
 * Auth store using localStorage for refresh token persistence
 * and sessionStorage for access token (tab-scoped security).
 */

export interface AuthUser {
  email: string;
  role: string;
  canDispatch?: boolean;
  teams?: Array<{ teamId: string; teamName: string; isLeader: boolean }>;
}

function parseJwtPayload(token: string): AuthUser | null {
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

export const authStore = {
  setTokens(accessToken: string, refreshToken: string) {
    // Access token: sessionStorage (cleared on tab close)
    sessionStorage.setItem('accessToken', accessToken);
    // Refresh token: localStorage (persists across tabs - HttpOnly cookie preferred in production)
    localStorage.setItem('refreshToken', refreshToken);
  },

  clearTokens() {
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  getAccessToken(): string | null {
    return sessionStorage.getItem('accessToken');
  },

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  },

  getUser(): AuthUser | null {
    const token = this.getAccessToken();
    if (!token) return null;
    return parseJwtPayload(token);
  },

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },
};
