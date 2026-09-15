import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import RestorePage from '../RestorePage';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
const m = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn> };

const ADMIN: AuthUser = {
  id: 'admin-1',
  email: 'admin@pc02.local',
  username: 'admin',
  firstName: 'Quản',
  lastName: 'Trị',
  role: 'ADMIN',
  canDispatch: true,
  teams: [],
  primaryTeam: null,
};

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

let rong = false;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    const data = rong
      ? []
      : [{ id: 'x1', name: 'Vụ án đã xoá', deletedAt: '2026-09-01T02:00:00.000Z' }];
    if (url.endsWith('/admin/deleted')) {
      return Promise.resolve({ data: { success: true, data, total: data.length } });
    }
    return Promise.resolve({ data: { success: true, data: [], total: 0 } });
  });
}

/** Tham số của lượt gọi CUỐI tới danh sách đã xoá của một loại hồ sơ. */
function thamSoCuoi(duong: string): Record<string, unknown> {
  const goi = m.get.mock.calls.filter((c) => (c as [string])[0] === duong);
  const cuoi = goi[goi.length - 1] as [string, { params?: Record<string, unknown> }] | undefined;
  return cuoi?.[1]?.params ?? {};
}

function dung(url = '/', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/', element: <RestorePage /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

/**
 * M6: màn Khôi phục tìm ở MÁY CHỦ bằng thẻ theo khai của TỪNG tab (Vụ án / Vụ việc / Đơn thư). Thẻ mỗi
 * tab nằm trên khoá URL riêng (`restoreCases_tk`…) — khoá của Vụ án (vd `doiTuongBiCan`) không có ở Đơn
 * thư, mang sang là 400 cả danh sách.
 */
describe('RestorePage — ô tìm kiếm dạng thẻ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    authStore.setProfile(ADMIN);
    traDuLieu();
  });

  it('gõ rồi Enter → gửi thẻ "tất cả các cột" tới danh sách đã xoá của tab, không gửi `search`', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    fireEvent.change(o, { target: { value: 'tham nhung' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() =>
      expect(thamSoCuoi('/cases/admin/deleted').tk).toEqual(['*~tham nhung']),
    );
    expect(thamSoCuoi('/cases/admin/deleted').search).toBeUndefined();
  });

  it('thẻ trên URL (`restoreCases_tk`) → gửi xuống máy chủ khi mở trang', async () => {
    dung('/?restoreCases_tk=stt~2026-15');
    await waitFor(() =>
      expect(thamSoCuoi('/cases/admin/deleted').tk).toEqual(['stt~2026-15']),
    );
  });

  it('thẻ của tab Vụ án KHÔNG mang sang tab Đơn thư', async () => {
    dung('/?restoreCases_tk=doiTuongBiCan~an');
    await waitFor(() => expect(thamSoCuoi('/cases/admin/deleted').tk).toBeDefined());
    fireEvent.click(screen.getByTestId('tab-petitions'));
    await waitFor(() =>
      expect(m.get.mock.calls.some((c) => (c as [string])[0] === '/petitions/admin/deleted')).toBe(
        true,
      ),
    );
    expect(thamSoCuoi('/petitions/admin/deleted').tk).toBeUndefined();
  });

  it('còn thẻ mà không có kết quả → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/?restoreCases_tk=stt~2026-99');
    const cau = await screen.findByText('Không tìm thấy với:');
    const vung = cau.parentElement as HTMLElement;
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ STT' })).toBeInTheDocument();
  });

  it('cờ tắt → ô chữ cũ, gửi `search`', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByTestId('search-input');
    fireEvent.change(o, { target: { value: 'an' } });
    await waitFor(() => expect(thamSoCuoi('/cases/admin/deleted').search).toBe('an'));
    expect(thamSoCuoi('/cases/admin/deleted').tk).toBeUndefined();
  });
});
