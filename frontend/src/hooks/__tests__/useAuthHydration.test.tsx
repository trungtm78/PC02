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
  permissions: ['read:Case'],
};

// JWT dạng thật (không cần chữ ký) — hydration chỉ ghi hồ sơ khi sub của token hiện hành khớp id hồ sơ.
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (x: string) => btoa(x).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64(JSON.stringify({ alg: 'RS256' }))}.${b64(JSON.stringify(payload))}.sig`;
}
const TOKEN_U1 = fakeJwt({ sub: 'u1', email: 'a@b.com', role: 'OFFICER' });
const TOKEN_U2 = fakeJwt({ sub: 'u2', email: 'c@d.com', role: 'OFFICER' });

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
    authStore.setTokens(TOKEN_U1, 'R');
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
    authStore.setTokens(TOKEN_U1, 'R');
    authStore.setProfile(SAMPLE_PROFILE);

    const useAuthHydration = await loadHook();
    meSpy.mockReset();
    // Hook's initial call should observe existing profile and skip
    renderHook(() => useAuthHydration());

    await new Promise((r) => setTimeout(r, 10));
    expect(meSpy).not.toHaveBeenCalled();
  });

  it('leaves profile null on /auth/me error (graceful degrade)', async () => {
    authStore.setTokens(TOKEN_U1, 'R');
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
    authStore.setTokens(TOKEN_U1, 'R');

    await waitFor(() => expect(meSpy).toHaveBeenCalledTimes(1));
    expect(authStore.getProfile()).toEqual(SAMPLE_PROFILE);
  });

  // Rà mã PR #435: /auth/me của A còn đang chạy thì B đăng nhập trong cùng tab → hồ sơ A về sau ghi đè phiên của B.
  it('hồ sơ trả về KHÔNG khớp chủ token hiện hành → không ghi (tranh chấp khi đổi tài khoản)', async () => {
    let traVeA!: (v: unknown) => void;
    meSpy.mockReturnValueOnce(new Promise((r) => (traVeA = r)));
    meSpy.mockResolvedValue({ data: { ...SAMPLE_PROFILE, id: 'u2' } });
    authStore.setTokens(TOKEN_U1, 'R');

    const useAuthHydration = await loadHook();
    renderHook(() => useAuthHydration());
    await waitFor(() => expect(meSpy).toHaveBeenCalledTimes(1));

    authStore.setTokens(TOKEN_U2, 'R'); // B đăng nhập khi /me của A chưa về
    await waitFor(() => expect(authStore.getProfile()?.id).toBe('u2'));
    traVeA({ data: SAMPLE_PROFILE }); // /me của A về muộn
    await new Promise((r) => setTimeout(r, 10));
    expect(authStore.getProfile()?.id).toBe('u2');
  });

  /**
   * Hồ sơ đệm từ TRƯỚC #435 (20/09/2026) không có `permissions` → usePermission coi là 'chưa biết, tạm cho hiện' mãi
   * tới khi đóng tab. Hỏi lại /auth/me MỘT lần cho token đó — máy chủ cũ không trả permissions cũng không lặp vô hạn
   * (setProfile phát sự kiện đổi token → hydrate chạy lại).
   */
  it('hồ sơ đệm thiếu permissions → hỏi lại /auth/me một lần và ghi hồ sơ mới', async () => {
    authStore.setTokens(TOKEN_U1, 'R');
    const cu: AuthUser = { ...SAMPLE_PROFILE };
    delete cu.permissions;
    authStore.setProfile(cu);
    meSpy.mockResolvedValue({ data: SAMPLE_PROFILE });

    const useAuthHydration = await loadHook();
    renderHook(() => useAuthHydration());

    await waitFor(() => expect(authStore.getProfile()?.permissions).toEqual(['read:Case']));
    expect(meSpy).toHaveBeenCalledTimes(1);
  });

  it('máy chủ vẫn không trả permissions → không hỏi lặp', async () => {
    authStore.setTokens(TOKEN_U1, 'R');
    const cu: AuthUser = { ...SAMPLE_PROFILE };
    delete cu.permissions;
    authStore.setProfile(cu);
    meSpy.mockResolvedValue({ data: cu });

    const useAuthHydration = await loadHook();
    renderHook(() => useAuthHydration());

    await waitFor(() => expect(meSpy).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 30));
    expect(meSpy).toHaveBeenCalledTimes(1);
  });
});
