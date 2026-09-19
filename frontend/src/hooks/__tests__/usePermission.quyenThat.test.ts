import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermission } from '../usePermission';
import { authStore } from '@/stores/auth.store';

vi.mock('@/stores/auth.store', () => ({ authStore: { getUser: vi.fn() } }));

/**
 * Ẩn/hiện nút theo QUYỀN THẬT của vai trò (19/09/2026, tồn đọng PR #217): hồ sơ /auth/me trả `permissions`
 * ('action:subject', đúng dạng PermissionsGuard). Trước đó MOCK_ALL_PERMISSIONS cho mọi người mọi quyền → cán bộ thấy
 * nút Xoá/Sửa rồi bấm mới nhận 403.
 */
const hoSo = (permissions: string[], role = 'OFFICER') =>
  ({ id: 'u1', email: 'a@b', role, teams: [], primaryTeam: null, permissions }) as never;

describe('usePermission — quyền thật từ /auth/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('có quyền trong danh sách → được; không có → không', () => {
    vi.mocked(authStore.getUser).mockReturnValue(hoSo(['read:Case', 'write:Case', 'edit:Case']));
    const { result } = renderHook(() => usePermission());
    expect(result.current.canView('cases')).toBe(true);
    expect(result.current.canCreate('cases')).toBe(true);
    expect(result.current.canEdit('cases')).toBe(true);
    expect(result.current.canDelete('cases')).toBe(false);
    expect(result.current.canView('petitions')).toBe(false);
  });

  it('SỬA dùng đúng hành động máy chủ đòi cho từng tài nguyên (edit / write)', () => {
    vi.mocked(authStore.getUser).mockReturnValue(hoSo(['write:Directory', 'edit:Petition']));
    const { result } = renderHook(() => usePermission());
    // Danh mục: PATCH/PUT đòi write (directory.controller) — không có "edit:Directory" vẫn sửa được.
    expect(result.current.canEdit('directories')).toBe(true);
    // Đơn thư: PUT đòi edit.
    expect(result.current.canEdit('petitions')).toBe(true);
    expect(result.current.canCreate('petitions')).toBe(false);
  });

  it('ADMIN không được ưu tiên riêng — theo đúng danh sách quyền như máy chủ', () => {
    vi.mocked(authStore.getUser).mockReturnValue(hoSo(['read:Case'], 'ADMIN'));
    const { result } = renderHook(() => usePermission());
    expect(result.current.canView('cases')).toBe(true);
    expect(result.current.canDelete('cases')).toBe(false);
  });

  it('hồ sơ CHƯA nạp quyền (chỉ có JWT) → tạm cho hiện, máy chủ vẫn chặn — không làm nút chớp tắt', () => {
    vi.mocked(authStore.getUser).mockReturnValue({ email: 'a@b', role: 'OFFICER' });
    const { result } = renderHook(() => usePermission());
    expect(result.current.canDelete('cases')).toBe(true);
  });
});

/**
 * Rà mã PR #435: màn vẽ trước khi /auth/me về thì nút vẫn theo chế độ "tạm cho hiện" tới lần vẽ lại kế tiếp — hook
 * phải tự vẽ lại khi hồ sơ/token đổi (sự kiện của authStore).
 */
describe('usePermission — tự cập nhật khi hồ sơ nạp xong', () => {
  it('trước khi có quyền: hiện; hồ sơ về (sự kiện auth-token-changed) → ẩn đúng quyền', async () => {
    const { act } = await import('@testing-library/react');
    const { TEN_SU_KIEN_DOI_TOKEN } = await import('@/stores/auth-su-kien');
    vi.mocked(authStore.getUser).mockReturnValue({ email: 'a@b', role: 'OFFICER' });
    const { result } = renderHook(() => usePermission());
    expect(result.current.canDelete('cases')).toBe(true);
    vi.mocked(authStore.getUser).mockReturnValue(hoSo(['read:Case']));
    act(() => {
      window.dispatchEvent(new CustomEvent(TEN_SU_KIEN_DOI_TOKEN));
    });
    expect(result.current.canDelete('cases')).toBe(false);
  });
});
