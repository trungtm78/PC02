import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import raw from '@/shared/processing/processing-codes.generated.json';
import { apDungBoCuc, type BoCucCot, type ColumnDef, type ListSort } from '@/components/shared/ListPageShell';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';
import { casesListFilters } from '@/features/cases/list-filters';
import { incidentsListFilters } from '@/features/incidents/list-filters';
import { petitionsListFilters } from '@/features/petitions/list-filters';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { AlertCell } from '../AlertCell';
import {
  ALERT_BAND_FILTER_KEY,
  ALERT_COLUMN_KEY,
  alertBandFilterField,
  alertColumn,
  effectiveFilters,
  effectiveSort,
  exportableColumnKeys,
  useListAlerts,
  withAlertColumn,
  type RowWithAlert,
} from '../listAlert';

interface Row extends RowWithAlert {
  id: string;
}

const col = (key: string, optional?: 'show' | 'hide'): ColumnDef<Row> => ({ key, header: key, optional, render: () => key });
/** A page's columns: an action column nobody can move, then data columns, the status among them. */
const PAGE: ColumnDef<Row>[] = [{ ...col('actions'), sticky: true }, col('stt'), col('sender', 'show'), col('summary', 'show'), col('status', 'show'), col('deadline', 'hide')];
const keys = (columns: ColumnDef<Row>[]) => columns.map((c) => c.key);

describe('the alert cell', () => {
  it('a record with no alert shows a dash and no colour', () => {
    render(<AlertCell alert={null} />);
    const cell = screen.getByTestId('alert-cell');
    expect(cell).toHaveTextContent(L.listAlert.none);
    expect(cell).not.toHaveAttribute('data-band');
    expect(cell.querySelector('.rounded-full')).toBeNull();
  });

  it('a record that has not reached any threshold shows the same dash, not a grey chip', () => {
    render(<AlertCell alert={{ source: 'FLOW', band: 'NONE', remainingDays: 40, stepName: 'Xác minh', dueAt: '2027-01-20T16:59:59.999Z' }} />);
    const cell = screen.getByTestId('alert-cell');
    expect(cell.textContent).toBe(L.listAlert.none);
    expect(cell).not.toHaveAttribute('data-band');
    expect(cell.querySelector('.rounded-full')).toBeNull();
  });

  it('an alert shows the chip, the step after it, and the whole sentence as its title', () => {
    render(<AlertCell alert={{ source: 'FLOW', band: 'RED', remainingDays: 1, stepName: 'Xác minh', dueAt: '2026-12-11T16:59:59.999Z' }} />);
    const cell = screen.getByTestId('alert-cell');
    expect(cell.textContent).toBe('Đỏ · còn 1 ngày · Xác minh');
    expect(cell).toHaveAttribute('title', 'Đỏ · còn 1 ngày · Xác minh');
    expect(cell.querySelector('.rounded-full')?.textContent).toBe('Đỏ · còn 1 ngày');
  });
});

describe('the alert column among a page columns', () => {
  it('is not there while the server answers no alerts: the very same array', () => {
    expect(withAlertColumn(PAGE, false, 'status')).toBe(PAGE);
  });

  it('sits right before the status column, can be hidden, and sorts most urgent first', () => {
    const columns = withAlertColumn(PAGE, true, 'status');
    expect(keys(columns)).toEqual(['actions', 'stt', 'sender', 'summary', 'alert', 'status', 'deadline']);
    expect(alertColumn<Row>()).toMatchObject({ key: ALERT_COLUMN_KEY, header: 'Cảnh báo', optional: 'show', sortKey: 'alert', sortFirst: 'asc' });
    expect(alertColumn<Row>().width).toMatch(/rem$/);
  });

  it('goes last when the page has no such column, rather than vanish', () => {
    expect(keys(withAlertColumn(PAGE, true, 'nothing'))).toEqual([...keys(PAGE), 'alert']);
  });

  it('leaves the alert column out of the columns an export is asked for', () => {
    expect(exportableColumnKeys(['stt', 'alert', 'status'])).toEqual(['stt', 'status']);
  });
});

describe('a person with a SAVED layout that never saw the alert column', () => {
  const columns = withAlertColumn(PAGE, true, 'status');

  it('who reordered the columns gets it next to its neighbour in the code, not at the far right', () => {
    // Saved before the column existed: status dragged to the front, every movable column given a position.
    const saved: BoCucCot = { status: { position: 0 }, sender: { position: 1 }, summary: { position: 2 }, deadline: { position: 3, hidden: false } };
    const shown = keys(apDungBoCuc(columns, saved));
    expect(shown).toContain('alert');
    expect(shown.indexOf('alert')).toBeLessThan(shown.length - 1);
    expect(shown.indexOf('alert')).toBe(shown.indexOf('summary') + 1);
    // Nothing the person had is lost or moved out of the order they chose.
    expect(shown.filter((k) => k !== 'alert')).toEqual(['actions', 'stt', 'status', 'sender', 'summary', 'deadline']);
  });

  it('who hid columns and set widths keeps both, and sees the new column', () => {
    const saved: BoCucCot = { summary: { hidden: true }, sender: { width: 321 } };
    const applied = apDungBoCuc(columns, saved);
    expect(keys(applied)).toEqual(['actions', 'stt', 'sender', 'alert', 'status']);
    expect(applied.find((c) => c.key === 'sender')?.width).toBe('321px');
    expect(applied.find((c) => c.key === 'alert')?.width).toBe(alertColumn<Row>().width);
  });

  it('who later hides the alert column keeps it hidden', () => {
    expect(keys(apDungBoCuc(columns, { alert: { hidden: true } }))).not.toContain('alert');
  });

  it('and the layout is untouched while the switch is off: a stored entry for the column is simply not used', () => {
    expect(keys(apDungBoCuc(withAlertColumn(PAGE, false, 'status'), { alert: { position: 0, width: 200 } }))).toEqual(['actions', 'stt', 'sender', 'summary', 'status']);
  });
});

describe('the filter by band', () => {
  it('offers every band of the contract after "all", worded by the band presenter', () => {
    const field = alertBandFilterField<{ alertBand?: string }>();
    expect(field).toMatchObject({ key: ALERT_BAND_FILTER_KEY, type: 'enumSelect', urlKey: 'alert', label: 'Cảnh báo' });
    expect(field.options?.map((o) => o.value)).toEqual(['', ...raw.bands]);
    expect(field.options?.map((o) => o.label)).toEqual(['Tất cả', 'Quá hạn', 'Đỏ', 'Vàng', 'Xanh', 'Chưa tới ngưỡng']);
  });

  it.each([
    ['petitions', petitionsListFilters],
    ['incidents', incidentsListFilters],
    ['cases', casesListFilters],
  ] as const)('is one field of the %s registry, under an address key no other field uses', (_name, registry) => {
    const fields = registry.all() as ReadonlyArray<{ key: string; urlKey: string; testid: string }>;
    expect(fields.filter((f) => f.key === ALERT_BAND_FILTER_KEY)).toHaveLength(1);
    expect(fields.filter((f) => f.urlKey === 'alert')).toHaveLength(1);
    expect(new Set(fields.map((f) => f.testid)).size).toBe(fields.length);
  });
});

describe('alert state of the address while the list answers no alerts', () => {
  const sort = (sortBy: string | undefined, sortOrder: 'asc' | 'desc' = 'asc'): ListSort => ({ sortBy, sortOrder, onSort: () => undefined, params: sortBy ? { sortBy, sortOrder } : {} });

  it('a band is no filter while off: dropped from the value, and the other fields are kept as they are', () => {
    const applied = { fromDate: '2026-12-01', alertBand: 'RED' };
    expect(effectiveFilters(applied, false)).toEqual({ fromDate: '2026-12-01' });
    expect(Object.values(effectiveFilters(applied, false)).filter(Boolean)).toHaveLength(1);
    expect(effectiveFilters(applied, true)).toBe(applied);
    const none: { fromDate: string; alertBand?: string } = { fromDate: '2026-12-01' };
    expect(effectiveFilters(none, false)).toBe(none);
  });

  it('an order by alert is no order while off: nothing is sent, so the server uses its default order', () => {
    expect(effectiveSort(sort('alert'), false)).toMatchObject({ sortBy: undefined, sortOrder: 'desc', params: {} });
    const byAlert = sort('alert');
    expect(effectiveSort(byAlert, true)).toBe(byAlert);
    const byDate = sort('createdAt');
    expect(effectiveSort(byDate, false)).toBe(byDate);
  });
});

describe('the clock of a list with alerts', () => {
  const flag = (enabled: boolean): FeatureFlag => ({ key: 'processing_flow_records', label: 'records', description: null, enabled, domain: null, rolloutPct: 100 });
  const withFlag = (enabled: boolean) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <FeatureFlagsProvider initialFlags={[flag(enabled)]}>{children}</FeatureFlagsProvider>;
    };

  it('before any answer it is what the feature flags say of the switch, and off when nothing says', () => {
    expect(renderHook(() => useListAlerts()).result.current.on).toBe(false);
    expect(renderHook(() => useListAlerts(), { wrapper: withFlag(false) }).result.current.on).toBe(false);
    const known = renderHook(() => useListAlerts(), { wrapper: withFlag(true) });
    expect(known.result.current.on).toBe(true);
    expect(known.result.current.hiddenFilterKeys).toEqual([]);
  });

  it('after an answer it is what the answer said, whatever the flags say', () => {
    const { result } = renderHook(() => useListAlerts(), { wrapper: withFlag(true) });
    act(() => void result.current.onAnswer('a', 1, {}, false));
    expect(result.current.on).toBe(false);
    expect(result.current.hiddenFilterKeys).toEqual([ALERT_BAND_FILTER_KEY]);
    act(() => void result.current.onAnswer('a', 1, { alertAsOf: 't1' }, false));
    expect(result.current.on).toBe(true);
    act(() => void result.current.onAnswer('a', 1, {}, false));
    expect(result.current.requestParams('a', 2, true)).toEqual({});
    expect(result.current.clockOf('a')).toBeNull();
  });

  it('an answer asked under the wrong guess is not to be drawn when the address holds alert state, and is otherwise', () => {
    // Guessed off, the server answers alerts.
    const off = renderHook(() => useListAlerts());
    off.result.current.requestParams('a', 1, false);
    let usable = true;
    act(() => void (usable = off.result.current.onAnswer('a', 1, { alertAsOf: 't1' }, true)));
    expect(usable).toBe(false);
    // Asked again, now under the right guess: drawn.
    off.result.current.requestParams('b', 1, true);
    act(() => void (usable = off.result.current.onAnswer('b', 1, { alertAsOf: 't2' }, true)));
    expect(usable).toBe(true);

    // Guessed on (a stale flag), the server answers none.
    const stale = renderHook(() => useListAlerts(), { wrapper: withFlag(true) });
    stale.result.current.requestParams('a', 1, true);
    act(() => void (usable = stale.result.current.onAnswer('a', 1, {}, true)));
    expect(usable).toBe(false);

    // The same surprise with nothing about alerts in the address: the rows are right, only the column appears.
    const plain = renderHook(() => useListAlerts());
    plain.result.current.requestParams('a', 1, false);
    act(() => void (usable = plain.result.current.onAnswer('a', 1, { alertAsOf: 't1' }, false)));
    expect(usable).toBe(true);
  });

  it('passes the first page instant to later pages of the SAME list, only when the list is by alert', () => {
    const { result } = renderHook(() => useListAlerts());
    expect(result.current.requestParams('a', 1, true)).toEqual({});
    act(() => void result.current.onAnswer('a', 1, { alertAsOf: 't1' }, false));
    expect(result.current.requestParams('a', 1, true)).toEqual({});
    expect(result.current.requestParams('a', 2, true)).toEqual({ alertAsOf: 't1' });
    expect(result.current.requestParams('a', 2, false)).toEqual({});
    expect(result.current.requestParams('b', 2, true)).toEqual({});
    // Page 2 answering does not move the instant; page 1 asked again does.
    act(() => void result.current.onAnswer('a', 2, { alertAsOf: 't1' }, false));
    expect(result.current.requestParams('a', 3, true)).toEqual({ alertAsOf: 't1' });
    act(() => void result.current.onAnswer('a', 1, { alertAsOf: 't2' }, false));
    expect(result.current.requestParams('a', 2, true)).toEqual({ alertAsOf: 't2' });
  });

  it('a list opened on a later page (a shared link) keeps the instant that page answered', () => {
    const { result } = renderHook(() => useListAlerts());
    act(() => void result.current.onAnswer('a', 3, { alertAsOf: 't3' }, false));
    expect(result.current.requestParams('a', 4, true)).toEqual({ alertAsOf: 't3' });
  });

  it('tells the instant of the list on screen, for its cards and exports: none until it answered, none for another list', () => {
    const { result } = renderHook(() => useListAlerts());
    expect(result.current.clockOf('a')).toBeNull();
    act(() => void result.current.onAnswer('a', 1, { alertAsOf: 't1' }, false));
    expect(result.current.clockOf('a')).toBe('t1');
    expect(result.current.clockOf('b')).toBeNull();
    act(() => void result.current.onAnswer('a', 1, { alertAsOf: 't2' }, false));
    expect(result.current.clockOf('a')).toBe('t2');
    act(() => void result.current.onAnswer('b', 1, { alertAsOf: 't3' }, false));
    expect(result.current.clockOf('a')).toBeNull();
    expect(result.current.clockOf('b')).toBe('t3');
  });
});
