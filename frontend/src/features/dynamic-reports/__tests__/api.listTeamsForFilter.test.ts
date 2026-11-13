import { describe, it, expect, vi } from 'vitest';
import { api } from '@/lib/api';
import { dynamicReportsApi } from '../api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
}));

/**
 * S27 "đơn vị" filter (PR8 slice 7) — the only client-side logic in this
 * thin fetch wrapper is the non-ward filter (the server already returns
 * active teams only), so it's the only part worth a dedicated test
 * (everything else is covered through the page tests that mock
 * `dynamicReportsApi` wholesale).
 */
describe('dynamicReportsApi.listTeamsForFilter', () => {
  it('calls /teams/options, keeps only non-ward teams and maps to {teamId, teamName}', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 't1', name: 'Đội 1', wardId: null },
        { id: 't3', name: 'Phường 1', wardId: 'ward1' },
        { id: 't4', name: 'Đội 2' }, // wardId omitted -> treated as non-ward.
      ],
    });

    const result = await dynamicReportsApi.listTeamsForFilter();

    expect(result).toEqual([
      { teamId: 't1', teamName: 'Đội 1' },
      { teamId: 't4', teamName: 'Đội 2' },
    ]);
    expect(api.get).toHaveBeenCalledWith('/teams/options');
  });

  it('handles the {data: [...]} envelope shape as well as a bare array', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [{ id: 't1', name: 'Đội 1', wardId: null }] },
    });

    const result = await dynamicReportsApi.listTeamsForFilter();

    expect(result).toEqual([{ teamId: 't1', teamName: 'Đội 1' }]);
  });
});
