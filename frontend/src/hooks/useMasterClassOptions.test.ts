import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useMasterClassOptions } from './useMasterClassOptions';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/lib/api';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useMasterClassOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array and is disabled when type is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMasterClassOptions(undefined), {
      wrapper,
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches options by type code and maps to value/label', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [
          { id: '1', name: 'Giết người (Điều 123 BLHS)' },
          { id: '2', name: 'Cướp tài sản (Điều 168 BLHS)' },
        ],
      },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useMasterClassOptions('07'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(vi.mocked(api.get)).toHaveBeenCalledWith(
      '/master-classes?type=07&limit=200&isActive=true',
    );
    expect(result.current.data).toEqual([
      { value: 'Giết người (Điều 123 BLHS)', label: 'Giết người (Điều 123 BLHS)' },
      { value: 'Cướp tài sản (Điều 168 BLHS)', label: 'Cướp tài sản (Điều 168 BLHS)' },
    ]);
  });

  it('returns empty array when API returns no data', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useMasterClassOptions('07'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('returns empty array when API returns null data field', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useMasterClassOptions('07'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('isolates cache by type code (different queryKeys)', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { data: [{ id: '1', name: 'Hình sự' }] } })
      .mockResolvedValueOnce({ data: { data: [{ id: '2', name: 'VKSND TP.HCM' }] } });

    const wrapper = createWrapper();
    const { result: r1 } = renderHook(() => useMasterClassOptions('07'), {
      wrapper,
    });
    const { result: r2 } = renderHook(() => useMasterClassOptions('08'), {
      wrapper,
    });

    await waitFor(() => {
      expect(r1.current.isSuccess).toBe(true);
      expect(r2.current.isSuccess).toBe(true);
    });

    expect(r1.current.data?.[0]?.value).toBe('Hình sự');
    expect(r2.current.data?.[0]?.value).toBe('VKSND TP.HCM');
  });

  it('propagates error state on API failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useMasterClassOptions('07'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
