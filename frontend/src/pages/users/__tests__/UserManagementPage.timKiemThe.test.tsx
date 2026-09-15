import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import UserManagementPage from '../UserManagementPage';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ canEdit: () => true, canDelete: () => true, canDispatch: true }),
}));

import { api } from '@/lib/api';
const m = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn> };

const CO_TAT_THE: FeatureFlag[] = [
  {
    key: 'TIM_KIEM_THE',
    label: 'Tìm kiếm dạng thẻ',
    description: null,
    enabled: false,
    domain: null,
    rolloutPct: 100,
  },
];

const NGUOI = {
  id: 'u1',
  username: 'an.nguyen',
  email: 'an@pc02.local',
  firstName: 'An',
  lastName: 'Nguyễn Văn',
  workId: 'CB01',
  isActive: true,
  role: { id: 'r1', name: 'OFFICER' },
};

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url === '/admin/users') return Promise.resolve({ data: { data: [NGUOI], total: 1 } });
    // `loadRoles` đặt thẳng `res.data` làm danh sách vai trò — máy chủ trả MẢNG.
    if (url === '/admin/roles') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: { data: [] } });
  });
}

/** Tham số của lượt gọi CUỐI tới `/admin/users`. */
function thamSoCuoi(): Record<string, unknown> {
  const goi = m.get.mock.calls.filter((c) => (c as [string])[0] === '/admin/users');
  const cuoi = goi[goi.length - 1] as [string, { params?: Record<string, unknown> }] | undefined;
  return cuoi?.[1]?.params ?? {};
}

function dung(url = '/', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/', element: <UserManagementPage /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

/**
 * M6: màn Quản lý người dùng tìm ở MÁY CHỦ bằng thẻ — gõ không dấu ra "Nguyễn", chọn cột (mã cán bộ,
 * họ tên, email, trạng thái, đăng nhập cuối). Thẻ nằm trên URL `users_tk`.
 */
describe('UserManagementPage — ô tìm kiếm dạng thẻ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    traDuLieu();
  });

  it('gõ rồi Enter → gửi thẻ "tất cả các cột", không gửi `search`', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    fireEvent.change(o, { target: { value: 'nguyen' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(thamSoCuoi().tk).toEqual(['*~nguyen']));
    expect(thamSoCuoi().search).toBeUndefined();
  });

  it('thẻ trên URL (`users_tk`) → gửi xuống máy chủ khi mở trang', async () => {
    dung('/?users_tk=trangThai~active');
    await waitFor(() => expect(thamSoCuoi().tk).toEqual(['trangThai~active']));
  });

  it('cờ tắt → ô chữ cũ, gửi `search`', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByPlaceholderText('Tìm kiếm theo mã cán bộ, họ tên, email...');
    fireEvent.change(o, { target: { value: 'an' } });
    await waitFor(() => expect(thamSoCuoi().search).toBe('an'));
    expect(thamSoCuoi().tk).toBeUndefined();
  });
});
