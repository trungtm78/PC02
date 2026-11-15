/**
 * The alert column of the petition, incident and case lists, as pieces the three pages plug into what they already
 * have: one column for their column list, one field for their filter registry, and the clock of the list.
 *
 * The column exists only while the server answers alerts (the switch `processing_flow_records` is on: the answer then
 * carries `alertAsOf`, and every row an `alert`). While it is off the pages are exactly what they were.
 */
import { createElement, useCallback, useRef, useState } from 'react';
import type { ColumnDef } from '@/components/shared/ListPageShell';
import type { FilterField } from '@/features/_shared/list-filters/registry';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { bandLabel, type RecordAlertDto } from '../bandPresenter';
import { BANDS } from '../record-tabs/codes';
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

export interface ListAlerts {
  /** The server answers alerts: draw the column and offer the filter. */
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
  /** Tell the hook what a list request answered. */
  onAnswer(listKey: string, page: number, answer: ListAnswerWithAlert): void;
}

const NO_KEYS: readonly string[] = [];
const HIDDEN_WHILE_OFF: readonly string[] = [ALERT_BAND_FILTER_KEY];

export function useListAlerts(): ListAlerts {
  const [on, setOn] = useState(false);
  const clock = useRef<{ listKey: string; asOf: string } | null>(null);

  const requestParams = useCallback((listKey: string, page: number, byAlert: boolean) => {
    const held = clock.current;
    return byAlert && page > 1 && held && held.listKey === listKey ? { alertAsOf: held.asOf } : {};
  }, []);

  const onAnswer = useCallback((listKey: string, page: number, answer: ListAnswerWithAlert) => {
    const asOf = typeof answer.alertAsOf === 'string' ? answer.alertAsOf : null;
    setOn(asOf !== null);
    if (asOf === null) clock.current = null;
    // The first page sets the instant; a later page only does when none is held for this list (a link to page 3).
    else if (page <= 1 || clock.current?.listKey !== listKey) clock.current = { listKey, asOf };
  }, []);

  return { on, hiddenFilterKeys: on ? NO_KEYS : HIDDEN_WHILE_OFF, requestParams, onAnswer };
}
