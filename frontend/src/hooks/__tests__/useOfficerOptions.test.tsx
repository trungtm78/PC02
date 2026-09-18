import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useOfficerOptions } from '../useOfficerOptions';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

function boc({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/**
 * Ô lọc cán bộ gọi `GET /admin/users`. Máy chủ khai `QueryUsersDto` với khoá `status` và bật
 * `forbidNonWhitelisted`, nên gửi khoá lạ là 400 và danh sách RỖNG — im lặng, không ai báo.
 *
 * Bản trước gửi `isActive: true`: ô lọc cán bộ rỗng trên cả ba trang danh sách suốt từ khi
 * viết. Monkey test bắt được ngày 09/09/2026 nhờ đọc lỗi console 400.
 */
describe('useOfficerOptions', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: [] });
  });

  it('lọc theo `status: active` — khoá máy chủ khai, KHÔNG phải `isActive`', async () => {
    renderHook(() => useOfficerOptions(true), { wrapper: boc });

    await waitFor(() => expect(get).toHaveBeenCalled());

    const [duong, cauHinh] = get.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(duong).toBe('/admin/users');
    expect(cauHinh.params).toEqual({ limit: 500, offset: 0, status: 'active' });
    expect(cauHinh.params).not.toHaveProperty('isActive');
  });

  /**
   * UAT prod 19/09/2026: prod có 245 tài khoản đang hoạt động mà ô chọn chỉ tải 200 → ~45 cán bộ KHÔNG chọn được để
   * lọc. Tải theo trang tới khi đủ `total` — không giả định số người dùng luôn dưới một ngưỡng.
   */
  it('tải ĐỦ mọi cán bộ qua nhiều trang (không cắt ở một ngưỡng)', async () => {
    const trang1 = Array.from({ length: 500 }, (_, i) => ({ id: `a${i}`, username: `cb${String(i).padStart(3, '0')}` }));
    get.mockReset();
    get
      .mockResolvedValueOnce({ data: { data: trang1, total: 501 } })
      .mockResolvedValueOnce({ data: { data: [{ id: 'cuoi', firstName: 'Cuối', lastName: 'Cán Bộ' }], total: 501 } });
    const { result } = renderHook(() => useOfficerOptions(true), { wrapper: boc });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(501);
    expect(result.current.data?.some((o) => o.value === 'cuoi')).toBe(true);
    expect((get.mock.calls[1] as [string, { params: Record<string, unknown> }])[1].params).toEqual({
      limit: 500,
      offset: 500,
      status: 'active',
    });
  });

  /**
   * UAT prod 19/09/2026: 13 cặp trùng họ tên (vd tài khoản cũ `mrtea` và `tra.buithanh.doi2` đều "Bùi Thanh Trà") →
   * hai dòng y hệt trong ô chọn, chọn nhầm là lọc ra 0. Trùng thì ghi kèm tên đăng nhập.
   */
  it('trùng họ tên → ghi kèm tên đăng nhập để phân biệt; không trùng thì giữ nguyên', async () => {
    get.mockResolvedValue({
      data: {
        data: [
          { id: 'u1', firstName: 'Trà', lastName: 'Bùi Thanh', username: 'mrtea' },
          { id: 'u2', firstName: 'Trà', lastName: 'Bùi Thanh', username: 'tra.buithanh.doi2' },
          { id: 'u3', firstName: 'An', lastName: 'Nguyễn', username: 'an' },
        ],
        total: 3,
      },
    });
    const { result } = renderHook(() => useOfficerOptions(true), { wrapper: boc });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([
      { value: 'u1', label: 'Bùi Thanh Trà (mrtea)' },
      { value: 'u2', label: 'Bùi Thanh Trà (tra.buithanh.doi2)' },
      { value: 'u3', label: 'Nguyễn An' },
    ]);
  });

  /** Sắp theo `createdAt` không có khoá phụ → giữa hai trang có thể lặp một người; loại trùng theo id. */
  it('người lặp giữa hai trang chỉ hiện một lần; trùng tên mà thiếu tên đăng nhập thì kèm id', async () => {
    const trang1 = Array.from({ length: 500 }, (_, i) => ({ id: `a${i}`, username: `cb${String(i).padStart(3, '0')}` }));
    get.mockReset();
    get
      .mockResolvedValueOnce({ data: { data: trang1, total: 502 } })
      .mockResolvedValueOnce({
        data: {
          data: [
            { id: 'a499', username: 'cb499' },
            { id: 'x1', firstName: 'Bình', lastName: 'Lê' },
            { id: 'x2', firstName: 'Bình', lastName: 'Lê' },
          ],
          total: 502,
        },
      });
    const { result } = renderHook(() => useOfficerOptions(true), { wrapper: boc });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const ds = result.current.data ?? [];
    expect(ds.filter((o) => o.value === 'a499')).toHaveLength(1);
    expect(ds.filter((o) => o.label.startsWith('Lê Bình')).map((o) => o.label).sort()).toEqual([
      'Lê Bình (x1)',
      'Lê Bình (x2)',
    ]);
  });

  it('dựng nhãn từ họ tên, lùi về tên đăng nhập khi thiếu', async () => {
    get.mockResolvedValue({
      data: [
        { id: 'u1', firstName: 'An', lastName: 'Nguyễn' },
        { id: 'u2', username: 'canbo2' },
      ],
    });

    const { result } = renderHook(() => useOfficerOptions(true), { wrapper: boc });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([
      { value: 'u2', label: 'canbo2' },
      { value: 'u1', label: 'Nguyễn An' },
    ]);
  });
});
