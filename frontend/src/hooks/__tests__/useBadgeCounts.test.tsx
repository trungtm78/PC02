import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBadgeCounts } from '../useBadgeCounts';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: { get: vi.fn() } }));
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('../usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

const counts = { cases: 3, suspects: 1, petitions: 2, incidents: 4, overdueRecords: 0 };

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: counts } } as never);
});

describe('the menu counts', () => {
  it('are asked for by whoever reads cases', async () => {
    held.value = ['read:Case', 'read:Petition'];
    const { result } = renderHook(() => useBadgeCounts());
    await waitFor(() => expect(result.current.counts).toEqual(counts));
    expect(api.get).toHaveBeenCalledWith('/dashboard/badge-counts');
  });

  it('are not asked for by somebody who does not read cases (the server would refuse every two minutes)', async () => {
    held.value = ['read:WardAssignment', 'write:WardAssignment'];
    const { result } = renderHook(() => useBadgeCounts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.counts.cases).toBe(0);
  });

  it('wait for the profile: not asked while it is not loaded, asked as soon as it says the person reads cases', async () => {
    held.value = null;
    const { result, rerender } = renderHook(() => useBadgeCounts());
    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
    held.value = ['read:Case'];
    rerender();
    await waitFor(() => expect(result.current.counts).toEqual(counts));
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
