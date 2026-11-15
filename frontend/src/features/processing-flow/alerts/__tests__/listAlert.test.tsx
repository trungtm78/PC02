import { describe, it, expect } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import raw from '@/shared/processing/processing-codes.generated.json';
import { apDungBoCuc, type BoCucCot, type ColumnDef } from '@/components/shared/ListPageShell';
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

describe('the clock of a list with alerts', () => {
  it('is off until an answer carries `alertAsOf`, and off again when one does not', () => {
    const { result } = renderHook(() => useListAlerts());
    expect(result.current.on).toBe(false);
    expect(result.current.hiddenFilterKeys).toEqual([ALERT_BAND_FILTER_KEY]);
    act(() => result.current.onAnswer('a', 1, { alertAsOf: 't1' }));
    expect(result.current.on).toBe(true);
    expect(result.current.hiddenFilterKeys).toEqual([]);
    act(() => result.current.onAnswer('a', 1, {}));
    expect(result.current.on).toBe(false);
    expect(result.current.requestParams('a', 2, true)).toEqual({});
  });

  it('passes the first page instant to later pages of the SAME list, only when the list is by alert', () => {
    const { result } = renderHook(() => useListAlerts());
    expect(result.current.requestParams('a', 1, true)).toEqual({});
    act(() => result.current.onAnswer('a', 1, { alertAsOf: 't1' }));
    expect(result.current.requestParams('a', 1, true)).toEqual({});
    expect(result.current.requestParams('a', 2, true)).toEqual({ alertAsOf: 't1' });
    expect(result.current.requestParams('a', 2, false)).toEqual({});
    expect(result.current.requestParams('b', 2, true)).toEqual({});
    // Page 2 answering does not move the instant; page 1 asked again does.
    act(() => result.current.onAnswer('a', 2, { alertAsOf: 't1' }));
    expect(result.current.requestParams('a', 3, true)).toEqual({ alertAsOf: 't1' });
    act(() => result.current.onAnswer('a', 1, { alertAsOf: 't2' }));
    expect(result.current.requestParams('a', 2, true)).toEqual({ alertAsOf: 't2' });
  });

  it('a list opened on a later page (a shared link) keeps the instant that page answered', () => {
    const { result } = renderHook(() => useListAlerts());
    act(() => result.current.onAnswer('a', 3, { alertAsOf: 't3' }));
    expect(result.current.requestParams('a', 4, true)).toEqual({ alertAsOf: 't3' });
  });
});
