import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { authStore, type AuthUser } from '@/stores/auth.store';

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

const meSpy = vi.fn();
vi.mock('@/lib/api', () => ({
  authApi: {
    me: () => meSpy(),
  },
}));

// Import AFTER mock so the hook resolves the mocked module.
async function loadHook() {
  const mod = await import('../useAuthHydration');
  return mod.useAuthHydration;
}

describe('useAuthHydration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    meSpy.mockReset();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('fetches /auth/me when token exists but no profile cached', async () => {
    authStore.setTokens('A', 'R');
    meSpy.mockResolvedValue({ data: SAMPLE_PROFILE });

    const useAuthHydration = await loadHook();
    renderHook(() => useAuthHydration());

    await waitFor(() => expect(meSpy).toHaveBeenCalledTimes(1));
    expect(authStore.getProfile()).toEqual(SAMPLE_PROFILE);
  });

  it('does NOT fetch when no token present', async () => {
    const useAuthHydration = await loadHook();
    renderHook(() => useAuthHydration());

    // Wait a tick — should not fire
    await new Promise((r) => setTimeout(r, 10));
    expect(meSpy).not.toHaveBeenCalled();
  });

  it('does NOT fetch when profile already cached', async () => {
    authStore.setTokens('A', 'R');
    authStore.setProfile(SAMPLE_PROFILE);

    const useAuthHydration = await loadHook();
    meSpy.mockReset();
    // Hook's initial call should observe existing profile and skip
    renderHook(() => useAuthHydration());

    await new Promise((r) => setTimeout(r, 10));
    expect(meSpy).not.toHaveBeenCalled();
  });

  it('leaves profile null on /auth/me error (graceful degrade)', async () => {
    authStore.setTokens('A', 'R');
    meSpy.mockRejectedValue(new Error('500'));

    const useAuthHydration = await loadHook();
    renderHook(() => useAuthHydration());

    await waitFor(() => expect(meSpy).toHaveBeenCalled());
    expect(authStore.getProfile()).toBeNull();
  });

  it('re-fetches when token changes mid-session (refresh token interceptor)', async () => {
    const useAuthHydration = await loadHook();
    meSpy.mockResolvedValue({ data: SAMPLE_PROFILE });

    renderHook(() => useAuthHydration());
    // Initially no token → no fetch
    await new Promise((r) => setTimeout(r, 5));
    expect(meSpy).not.toHaveBeenCalled();

    // Token gets set → triggers tokenSignal → hook re-runs hydrate
    authStore.setTokens('A', 'R');

    await waitFor(() => expect(meSpy).toHaveBeenCalledTimes(1));
    expect(authStore.getProfile()).toEqual(SAMPLE_PROFILE);
  });
});
