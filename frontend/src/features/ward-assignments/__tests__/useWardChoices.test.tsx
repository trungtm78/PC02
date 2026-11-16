import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useApprovedOfUnit } from '../useWardChoices';
import { wardAssignmentsApi } from '../api';
import type { WardAssignmentRow, WardListQuery } from '../types';

vi.mock('../api', async (orig) => {
  const real = await orig<typeof import('../api')>();
  return { ...real, wardAssignmentsApi: { list: vi.fn() } };
});
const api = vi.mocked(wardAssignmentsApi);

const row = (i: number, teamId: string) => ({ id: `w${i}`, assignedTeamId: teamId, code: `2026-${i}` }) as unknown as WardAssignmentRow;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.resetAllMocks());

describe('the approved requests a re-assignment may name', () => {
  it('reads every page, not only the first 200, and keeps the unit’s', async () => {
    // 450 approved requests; the unit's one is on the third page.
    const all = Array.from({ length: 450 }, (_, i) => row(i, i === 420 ? 't1' : 'tx'));
    api.list.mockImplementation(async (q: WardListQuery) => {
      const page = q.page ?? 1;
      const size = q.pageSize ?? 50;
      return { data: all.slice((page - 1) * size, page * size), total: all.length };
    });
    const { result } = renderHook(() => useApprovedOfUnit('t1', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((r) => r.id)).toEqual(['w420']);
    expect(api.list).toHaveBeenCalledTimes(3);
  });

  it('stops on a page that adds nothing (a server that ignores the page)', async () => {
    const page = Array.from({ length: 200 }, (_, i) => row(i, 't1'));
    api.list.mockResolvedValue({ data: page, total: 999 });
    const { result } = renderHook(() => useApprovedOfUnit('t1', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(200);
    expect(api.list).toHaveBeenCalledTimes(2);
  });
});
