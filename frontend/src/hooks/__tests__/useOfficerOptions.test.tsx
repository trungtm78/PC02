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
    expect(cauHinh.params).toEqual({ limit: 200, status: 'active' });
    expect(cauHinh.params).not.toHaveProperty('isActive');
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
