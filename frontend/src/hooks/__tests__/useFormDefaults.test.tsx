import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { useFormDefaults } from '../useFormDefaults';

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

const NO_TEAM_PROFILE: AuthUser = {
  ...SAMPLE_PROFILE,
  id: 'admin1',
  teams: [],
  primaryTeam: null,
};

describe('useFormDefaults', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('returns isLoaded=false when no profile cached', () => {
    const { result } = renderHook(() => useFormDefaults());
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.userId).toBeNull();
    expect(result.current.primaryTeamId).toBeNull();
    expect(result.current.primaryTeamName).toBeNull();
  });

  it('returns today() in YYYY-MM-DD even when profile is missing', () => {
    const { result } = renderHook(() => useFormDefaults());
    expect(result.current.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns userId + primaryTeam when profile loaded', () => {
    authStore.setProfile(SAMPLE_PROFILE);
    const { result } = renderHook(() => useFormDefaults());

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.userId).toBe('u1');
    expect(result.current.primaryTeamId).toBe('t1');
    expect(result.current.primaryTeamName).toBe('Đội 1');
  });

  it('handles primaryTeam=null (admin with no team)', () => {
    authStore.setProfile(NO_TEAM_PROFILE);
    const { result } = renderHook(() => useFormDefaults());

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.userId).toBe('admin1');
    expect(result.current.primaryTeamId).toBeNull();
    expect(result.current.primaryTeamName).toBeNull();
  });

  it('re-renders when profile is set after initial render', () => {
    const { result } = renderHook(() => useFormDefaults());
    expect(result.current.isLoaded).toBe(false);

    act(() => {
      authStore.setProfile(SAMPLE_PROFILE);
    });

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.userId).toBe('u1');
  });

  it('re-renders when profile is cleared', () => {
    authStore.setProfile(SAMPLE_PROFILE);
    const { result } = renderHook(() => useFormDefaults());
    expect(result.current.isLoaded).toBe(true);

    act(() => {
      authStore.clearTokens();
    });

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.userId).toBeNull();
  });
});
