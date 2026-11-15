import { describe, it, expect, vi, beforeEach } from 'vitest';
import raw from '@/shared/processing/processing-codes.generated.json';

const http = vi.hoisted(() => ({ get: vi.fn() }));
const download = vi.hoisted(() => ({ triggerDownload: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: http }));
vi.mock('@/features/document-templates/export.api', () => download);

import { backlogApi, EXPORT_FALLBACK_NAME } from '../api';
import { dayParam, monthOf } from '../backlogKeys';
import { treeOrder } from '../tree';
import { BACKLOG_BANDS, type BacklogUnitRow } from '../types';

const AS_OF = '2026-12-10T02:30:00.000Z';

const unit = (teamId: string, parentTeamId: string | null, over: Partial<BacklogUnitRow> = {}): BacklogUnitRow => ({
  teamId,
  teamName: teamId,
  parentTeamId,
  holding: 0,
  OVERDUE: 0,
  RED: 0,
  YELLOW: 0,
  GREEN: 0,
  NONE: 0,
  oldestDueAt: null,
  oldestDays: null,
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  http.get.mockResolvedValue({ data: { ok: true }, headers: {} });
});

describe('the backlog routes', () => {
  it('asks the table with only the filters that are set; the default role is left out', async () => {
    await backlogApi.units({ kind: null, role: 'MAIN', from: null, to: null, unitId: null }, false);
    expect(http.get).toHaveBeenLastCalledWith('/processing/backlog/units', { params: {} });
    // Rolled up: the server does the roll-up, the screen only asks for it.
    await backlogApi.units({ kind: null, role: 'MAIN', from: null, to: null, unitId: null }, true);
    expect(http.get).toHaveBeenLastCalledWith('/processing/backlog/units', { params: { rollup: true } });
    await backlogApi.units({ kind: 'CASE', role: 'CHECK', from: '2026-11-01', to: '2026-11-30', unitId: null }, false);
    expect(http.get).toHaveBeenLastCalledWith('/processing/backlog/units', {
      params: { kind: 'CASE', role: 'CHECK', from: '2026-11-01', to: '2026-11-30' },
    });
  });

  it('asks the rows of a cell from the tracking list, with the unit, the band and the instant of the table', async () => {
    await backlogApi.cellItems({ kind: 'PETITION', role: 'COORDINATE', from: '2026-11-01', to: null, unitId: 'doi-9', teamId: 't3', band: 'NONE', asOf: AS_OF, page: 2, pageSize: 20 });
    expect(http.get).toHaveBeenLastCalledWith('/processing/tracking/items', {
      params: { kind: 'PETITION', role: 'COORDINATE', from: '2026-11-01', teamId: 't3', band: 'NONE', asOf: AS_OF, page: 2, pageSize: 20 },
    });
  });

  it('sends the unit filter as `teamId` with the table, the export and the on-time report; the rows of a cell keep the unit of the CELL', async () => {
    await backlogApi.units({ kind: null, role: 'MAIN', from: null, to: null, unitId: 'doi-1' }, true);
    expect(http.get).toHaveBeenLastCalledWith('/processing/backlog/units', { params: { teamId: 'doi-1', rollup: true } });
    await backlogApi.onTime({ kind: null, role: 'MAIN', from: '2026-11-01', to: '2026-11-30', unitId: 'doi-1', rolledUp: true });
    expect(http.get).toHaveBeenLastCalledWith('/processing/backlog/on-time', { params: { from: '2026-11-01', to: '2026-11-30', teamId: 'doi-1', rollup: true } });
    http.get.mockResolvedValueOnce({ data: new Blob(['x']), headers: {} });
    await backlogApi.exportUnits({ kind: null, role: 'MAIN', from: null, to: null, unitId: 'doi-1' }, null, false);
    expect(http.get).toHaveBeenLastCalledWith('/processing/backlog/units/export', { params: { teamId: 'doi-1' }, responseType: 'blob' });
  });

  it('asks the units of the filter from the backlog itself, with no parameter', async () => {
    await backlogApi.teams();
    expect(http.get).toHaveBeenLastCalledWith('/processing/backlog/teams');
  });

  it('asks the records with no flow of one unit and one kind', async () => {
    await backlogApi.unapplied({ teamId: 'to-1', kind: 'INCIDENT' }, 2, 20);
    expect(http.get).toHaveBeenLastCalledWith('/processing/backlog/unapplied', { params: { kind: 'INCIDENT', teamId: 'to-1', page: 2, pageSize: 20 } });
  });

  it('asks the on-time report with its period', async () => {
    await backlogApi.onTime({ kind: null, role: 'MAIN', from: '2026-11-01', to: '2026-11-30', unitId: null, rolledUp: false });
    expect(http.get).toHaveBeenLastCalledWith('/processing/backlog/on-time', { params: { from: '2026-11-01', to: '2026-11-30' } });
  });

  it('exports with the filters and the instant on screen, as a blob, and leaves the file name to the server', async () => {
    const response = { data: new Blob(['x']), headers: { 'content-disposition': 'attachment; filename="ton-dong-theo-don-vi-2026-12-10.xlsx"' } };
    http.get.mockResolvedValueOnce(response);
    await backlogApi.exportUnits({ kind: 'INCIDENT', role: 'CHECK', from: null, to: '2026-12-01', unitId: null }, AS_OF, false);
    expect(http.get).toHaveBeenLastCalledWith('/processing/backlog/units/export', {
      params: { kind: 'INCIDENT', role: 'CHECK', to: '2026-12-01', asOf: AS_OF },
      responseType: 'blob',
    });
    // The whole response goes to the shared helper, which reads Content-Disposition; ours is only the fallback name.
    expect(download.triggerDownload).toHaveBeenCalledWith(response, EXPORT_FALLBACK_NAME);
  });

  it('exports the table rolled up when the screen is rolled up', async () => {
    http.get.mockResolvedValueOnce({ data: new Blob(['x']), headers: {} });
    await backlogApi.exportUnits({ kind: null, role: 'MAIN', from: null, to: null, unitId: null }, AS_OF, true);
    expect(http.get).toHaveBeenLastCalledWith('/processing/backlog/units/export', { params: { asOf: AS_OF, rollup: true }, responseType: 'blob' });
  });

  it('the columns of the table are the bands of the contract, not a copy', () => {
    expect([...BACKLOG_BANDS]).toEqual(raw.bands);
    expect(BACKLOG_BANDS).toContain('NONE');
  });
});

describe('the units as a tree', () => {
  it('puts children under their parent, whatever order the server sent them in', () => {
    const rows = [unit('to-2', 'doi-1'), unit('doi-2', null), unit('doi-1', null), unit('to-1', 'doi-1'), unit('nhom-a', 'to-2'), unit('to-9', 'doi-2')];
    expect(treeOrder(rows).map(({ row, depth }) => `${row.teamId}@${depth}`)).toEqual(['doi-2@0', 'to-9@1', 'doi-1@0', 'to-2@1', 'nhom-a@2', 'to-1@1']);
  });

  it('a unit whose parent is not in the table stands at the top, and a cycle loses no row', () => {
    expect(treeOrder([unit('to-1', 'doi-hidden')]).map(({ row, depth }) => `${row.teamId}@${depth}`)).toEqual(['to-1@0']);
    const cycle = treeOrder([unit('a', 'b'), unit('b', 'a')]);
    expect(cycle.map(({ row }) => row.teamId).sort()).toEqual(['a', 'b']);
  });
});

describe('the days of the address and the default period', () => {
  it('takes a day only in the form YYYY-MM-DD', () => {
    expect(dayParam('2026-11-05')).toBe('2026-11-05');
    expect(dayParam('05/11/2026')).toBeNull();
    expect(dayParam(null)).toBeNull();
  });

  it('the month of a day runs from its first day to its last, leap years included', () => {
    expect(monthOf('2026-11-15')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthOf('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(monthOf('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});
