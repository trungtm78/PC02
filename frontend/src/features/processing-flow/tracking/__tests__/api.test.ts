import { describe, it, expect, vi, beforeEach } from 'vitest';
import raw from '@/shared/processing/processing-codes.generated.json';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: http }));

import { trackingApi } from '../api';
import { TRACKED_BANDS } from '../types';
import { recordTabFromSearch, recordTabHref } from '../../record-tabs/recordLink';

beforeEach(() => {
  vi.resetAllMocks();
  http.get.mockResolvedValue({ data: { ok: true } });
});

describe('the tracking routes', () => {
  it('asks the cards with only the filters that are set, and never with an instant', async () => {
    await trackingApi.summary({ mine: false, teamId: null, kind: null });
    expect(http.get).toHaveBeenLastCalledWith('/processing/tracking/summary', { params: {} });
    await trackingApi.summary({ mine: true, teamId: 't3', kind: 'CASE' });
    expect(http.get).toHaveBeenLastCalledWith('/processing/tracking/summary', { params: { mine: true, teamId: 't3', kind: 'CASE' } });
  });

  it('asks the list with the instant of the cards, the card and the page', async () => {
    await trackingApi.items({ mine: false, teamId: null, kind: null, band: 'RED', asOf: '2026-12-10T02:30:00.000Z', page: 2, pageSize: 20 });
    expect(http.get).toHaveBeenLastCalledWith('/processing/tracking/items', {
      params: { band: 'RED', asOf: '2026-12-10T02:30:00.000Z', page: 2, pageSize: 20 },
    });
    await trackingApi.items({ mine: true, teamId: 't1', kind: 'PETITION', band: null, asOf: 'x', page: 1, pageSize: 20 });
    expect(http.get).toHaveBeenLastCalledWith('/processing/tracking/items', {
      params: { mine: true, teamId: 't1', kind: 'PETITION', asOf: 'x', page: 1, pageSize: 20 },
    });
  });

  it('returns the body, not the axios response', async () => {
    http.get.mockResolvedValueOnce({ data: { asOf: 'x', counts: {} } });
    await expect(trackingApi.summary({ mine: false, teamId: null, kind: null })).resolves.toEqual({ asOf: 'x', counts: {} });
  });

  it('the bands with a card are the colours of the contract, not a copy', () => {
    expect([...TRACKED_BANDS]).toEqual(raw.bands.filter((b) => b !== 'NONE'));
    expect([...TRACKED_BANDS]).toEqual(['OVERDUE', 'RED', 'YELLOW', 'GREEN']);
  });
});

describe('the address of a record opened on a processing tab', () => {
  it('names the form of each kind and the tab', () => {
    expect(recordTabHref('PETITION', 'p1')).toBe('/petitions/p1?tab=phan-cong-xu-ly');
    expect(recordTabHref('INCIDENT', 'i1')).toBe('/incidents/i1?tab=phan-cong-xu-ly');
    expect(recordTabHref('CASE', 'c1')).toBe('/cases/c1/edit?tab=phan-cong-xu-ly');
    expect(recordTabHref('CASE', 'c1', 'ket-qua-xu-ly')).toBe('/cases/c1/edit?tab=ket-qua-xu-ly');
    expect(recordTabHref('PETITION', 'a/b')).toBe('/petitions/a%2Fb?tab=phan-cong-xu-ly');
  });

  it('reads only a record tab from an address', () => {
    expect(recordTabFromSearch('?tab=phan-cong-xu-ly')).toBe('phan-cong-xu-ly');
    expect(recordTabFromSearch('?returnPath=/cases&tab=ket-qua-xu-ly')).toBe('ket-qua-xu-ly');
    expect(recordTabFromSearch('?tab=info')).toBeNull();
    expect(recordTabFromSearch('')).toBeNull();
  });
});
