/**
 * The alert column of the petition, incident and case lists, as pieces the three pages plug into what they already
 * have: one column for their column list, one field for their filter registry, and the clock of the list.
 *
 * The column exists only while the server answers alerts (the switch `processing_flow_records` is on: the answer then
 * carries `alertAsOf`, and every row an `alert`). While it is off the pages are exactly what they were.
 */
import { createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ColumnDef, ListSort } from '@/components/shared/ListPageShell';
import type { FilterField } from '@/features/_shared/list-filters/registry';
import { FeatureFlagsContext } from '@/lib/features/featureFlagsContextObject';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { bandLabel, type RecordAlertDto } from '../bandPresenter';
import { BANDS } from '../record-tabs/codes';
import { RECORDS_FEATURE_KEY } from '../record-tabs/tabAvailability';
import { AlertCell } from './AlertCell';

/** The key of the column in a saved layout, and of the value of `sortBy` that orders a list by its alert. */
export const ALERT_COLUMN_KEY = 'alert';
export const ALERT_SORT_KEY = 'alert';
/** The key of the band in a page's filter value, and the query parameter of the same name. */
export const ALERT_BAND_FILTER_KEY = 'alertBand';

/** What a row of the three lists may carry. */
export interface RowWithAlert {
  alert?: RecordAlertDto | null;
}

/** What the answer of the three lists may carry at its root. */
export interface ListAnswerWithAlert {
  /** The instant the alerts of this answer were judged at. Absent while the switch is off. */
  alertAsOf?: string;
}

/**
 * The column. Content measured on the words it can hold: the chip is at most "Chưa tới ngưỡng · còn 999 ngày" (about
 * 30 characters at 12 px) and wraps onto a second line with the step name, which 12rem fits without widening a table
 * that is already wide. Sorting starts at `asc`: the server answers the most urgent first to that.
 */
export function alertColumn<TRow extends RowWithAlert>(): ColumnDef<TRow> {
  return {
    key: ALERT_COLUMN_KEY,
    header: L.listAlert.column,
    width: '12rem',
    optional: 'show',
    sortKey: ALERT_SORT_KEY,
    sortFirst: 'asc',
    render: (row) => createElement(AlertCell, { alert: row.alert }),
  };
}

/**
 * The page's columns with the alert column put right before the column `beforeKey` (the record's status), or the
 * columns untouched while the server answers no alerts. A person with a saved layout gets the column where the code
 * declares it: `sapXepCot` slots a column the layout never saw next to its neighbour in the code.
 */
export function withAlertColumn<TRow extends RowWithAlert>(columns: ColumnDef<TRow>[], on: boolean, beforeKey: string): ColumnDef<TRow>[] {
  if (!on) return columns;
  const at = columns.findIndex((column) => column.key === beforeKey);
  const index = at < 0 ? columns.length : at;
  return [...columns.slice(0, index), alertColumn<TRow>(), ...columns.slice(index)];
}

/** The keys of the visible columns an Excel export may be asked for: the export has no alert column. */
export const exportableColumnKeys = (keys: readonly string[]): string[] => keys.filter((key) => key !== ALERT_COLUMN_KEY);

/** The filter by band, for a page's filter registry: every band of the contract, "not near yet" included. */
export function alertBandFilterField<TValue extends { alertBand?: string }>(): FilterField<TValue> {
  return {
    key: ALERT_BAND_FILTER_KEY as keyof TValue & string,
    label: L.listAlert.filter,
    type: 'enumSelect',
    urlKey: 'alert',
    testid: 'filter-alert-band',
    options: [{ value: '', label: L.listAlert.filterAll }, ...BANDS.map((band) => ({ value: band, label: bandLabel(band) }))],
  };
}

/**
 * The filter value a page works with: while the list answers no alerts, a band left in the address (a link shared
 * from a session where the switch was on) is NOT a filter. It is not sent, not counted, and an empty list is not
 * blamed on it.
 */
export function effectiveFilters<TValue extends { alertBand?: string }>(applied: TValue, on: boolean): TValue {
  if (on || !applied.alertBand) return applied;
  const { alertBand: _dropped, ...rest } = applied;
  void _dropped;
  return rest as TValue;
}

/**
 * The order a page works with: while the list answers no alerts, an alert order left in the address is NO order at
 * all (the default order of the list). Sent as it stands, the server would not know the column and fall back to its
 * default field ASCENDING: oldest first, which nobody asked for.
 */
export function effectiveSort(sort: ListSort, on: boolean): ListSort {
  if (on || sort.sortBy !== ALERT_SORT_KEY) return sort;
  return { ...sort, sortBy: undefined, sortOrder: 'desc', params: {} };
}

export interface ListAlerts {
  /**
   * The list answers alerts: draw the column, offer the filter, honour the alert state of the address.
   *
   * Before the first answer this is what the feature flags of the app say of the switch (off when they do not know);
   * after it, whether the answer carried `alertAsOf`. So the FIRST request of a page already carries a band or an
   * alert order found in the address when the switch is known to be on, and never does while it is off.
   */
  on: boolean;
  /** The filter fields to keep hidden right now (for `<Filters hiddenKeys>`). */
  hiddenFilterKeys: readonly string[];
  /**
   * The extra parameter of a list request. A list filtered or ordered by alert must judge every page at ONE instant,
   * or a record that changes colour between two pages is shown twice or never: pages after the first pass back the
   * `alertAsOf` the first page of the same list answered.
   *
   * `listKey`: everything that makes it the same list (filters, search, order), without the page.
   */
  requestParams(listKey: string, page: number, byAlert: boolean): { alertAsOf?: string };
  /**
   * Tell the hook what a list request answered. Answers `false` when the rows must NOT be drawn: the address holds
   * alert state (`alertInAddress`) and the request was sent under the wrong guess of the switch, so it was filtered
   * and ordered wrongly. `on` has just changed, the page asks again, and the table stays on its loading state
   * meanwhile: no list in the wrong order is shown and then swapped.
   */
  onAnswer(listKey: string, page: number, answer: ListAnswerWithAlert, alertInAddress: boolean): boolean;
  /**
   * The instant the list `listKey` on screen was judged at, or `null` while it has not answered. The cards and the
   * exports of a list filtered by band pass it, so they count and write the very rows the list shows.
   */
  clockOf(listKey: string): string | null;
}

const NO_KEYS: readonly string[] = [];
const HIDDEN_WHILE_OFF: readonly string[] = [ALERT_BAND_FILTER_KEY];

interface Clock {
  listKey: string;
  asOf: string;
}

export function useListAlerts(): ListAlerts {
  const flags = useContext(FeatureFlagsContext);
  const guessed = flags?.flags.get(RECORDS_FEATURE_KEY)?.enabled === true;
  /** What the last answer said; `null` until a list answered. */
  const [answered, setAnswered] = useState<boolean | null>(null);
  const on = answered ?? guessed;

  // The clock twice: the ref for the request that leaves in the same tick, the state for what is drawn from it.
  const clock = useRef<Clock | null>(null);
  const [held, setHeld] = useState<Clock | null>(null);
  /** What `on` was when the last request left. */
  const askedOn = useRef(on);
  const onNow = useRef(on);
  useEffect(() => {
    onNow.current = on;
  }, [on]);

  const requestParams = useCallback((listKey: string, page: number, byAlert: boolean) => {
    askedOn.current = onNow.current;
    const now = clock.current;
    return byAlert && page > 1 && now && now.listKey === listKey ? { alertAsOf: now.asOf } : {};
  }, []);

  const onAnswer = useCallback((listKey: string, page: number, answer: ListAnswerWithAlert, alertInAddress: boolean) => {
    const asOf = typeof answer.alertAsOf === 'string' ? answer.alertAsOf : null;
    setAnswered(asOf !== null);
    let next = clock.current;
    if (asOf === null) next = null;
    // The first page sets the instant; a later page only does when none is held for this list (a link to page 3).
    else if (page <= 1 || next?.listKey !== listKey) next = { listKey, asOf };
    if (next !== clock.current) {
      clock.current = next;
      setHeld(next);
    }
    return !(alertInAddress && (asOf !== null) !== askedOn.current);
  }, []);

  const clockOf = useCallback((listKey: string) => (held && held.listKey === listKey ? held.asOf : null), [held]);

  return { on, hiddenFilterKeys: on ? NO_KEYS : HIDDEN_WHILE_OFF, requestParams, onAnswer, clockOf };
}
