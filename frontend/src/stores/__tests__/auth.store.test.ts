import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authStore, type AuthUser } from '../auth.store';

const SAMPLE_PROFILE: AuthUser = {
  id: 'u1',
  email: 'a@b.com',
  username: 'a',
  firstName: 'A',
  lastName: 'B',
  role: 'OFFICER',
  canDispatch: false,
  teams: [{ teamId: 't1', teamName: 'Đội 1', isLeader: true }],
  primaryTeam: { teamId: 't1', teamName: 'Đội 1' },
};

// Build a minimal RS256-shaped JWT without a real signature — parseJwtPayload only base64-decodes the middle segment.
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (s: string) => btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64(JSON.stringify({ alg: 'RS256' }))}.${b64(JSON.stringify(payload))}.sig`;
}

describe('authStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('setTokens / getAccessToken / getRefreshToken', () => {
    it('stores access in sessionStorage and refresh in localStorage', () => {
      authStore.setTokens('A', 'R');
      expect(authStore.getAccessToken()).toBe('A');
      expect(authStore.getRefreshToken()).toBe('R');
      expect(sessionStorage.getItem('accessToken')).toBe('A');
      expect(localStorage.getItem('refreshToken')).toBe('R');
    });

    it('isAuthenticated reflects access token presence', () => {
      expect(authStore.isAuthenticated()).toBe(false);
      authStore.setTokens('A', 'R');
      expect(authStore.isAuthenticated()).toBe(true);
    });
  });

  describe('setProfile / getProfile', () => {
    it('round-trips the profile through sessionStorage', () => {
      authStore.setProfile(SAMPLE_PROFILE);
      expect(authStore.getProfile()).toEqual(SAMPLE_PROFILE);
    });

    it('returns null when no profile is stored', () => {
      expect(authStore.getProfile()).toBeNull();
    });

    it('returns null when stored profile JSON is corrupt', () => {
      sessionStorage.setItem('authProfile', '{not json');
      expect(authStore.getProfile()).toBeNull();
    });
  });

  describe('getUser', () => {
    it('prefers cached profile over JWT decode', () => {
      const token = fakeJwt({ email: 'wrong@example.com', role: 'WRONG', canDispatch: true });
      authStore.setTokens(token, 'R');
      authStore.setProfile(SAMPLE_PROFILE);

      const user = authStore.getUser();
      expect(user).toEqual(SAMPLE_PROFILE);
      // Profile.email took precedence
      expect((user as AuthUser).email).toBe('a@b.com');
      expect((user as AuthUser).id).toBe('u1');
    });

    it('falls back to JWT-decoded subset when no profile cached (back-compat)', () => {
      const token = fakeJwt({ email: 'jwt@example.com', role: 'OFFICER', canDispatch: false });
      authStore.setTokens(token, 'R');

      const user = authStore.getUser();
      expect(user).toEqual({ email: 'jwt@example.com', role: 'OFFICER', canDispatch: false });
      // No id/teams/primaryTeam in fallback shape
      expect((user as { id?: string }).id).toBeUndefined();
    });

    it('returns null when no token is present', () => {
      expect(authStore.getUser()).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('removes accessToken, refreshToken, and authProfile', () => {
      authStore.setTokens('A', 'R');
      authStore.setProfile(SAMPLE_PROFILE);

      authStore.clearTokens();

      expect(authStore.getAccessToken()).toBeNull();
      expect(authStore.getRefreshToken()).toBeNull();
      expect(authStore.getProfile()).toBeNull();
      expect(authStore.getUser()).toBeNull();
    });
  });

  describe('onTokenChanged', () => {
    it('fires subscribers on setTokens / setProfile / clearTokens', () => {
      const handler = vi.fn();
      const unsubscribe = authStore.onTokenChanged(handler);

      authStore.setTokens('A', 'R');
      expect(handler).toHaveBeenCalledTimes(1);

      authStore.setProfile(SAMPLE_PROFILE);
      expect(handler).toHaveBeenCalledTimes(2);

      authStore.clearTokens();
      expect(handler).toHaveBeenCalledTimes(3);

      unsubscribe();
      authStore.setTokens('B', 'R2');
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });
});
