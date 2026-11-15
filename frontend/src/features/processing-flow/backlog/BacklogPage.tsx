/**
 * /ton-dong-theo-don-vi — "Tồn đọng theo đơn vị": one row per unit with the work it holds in each alert band, and
 * under it the on-time rate over a period.
 *
 * A NUMBER of the table opens exactly the rows it counts: the list is asked with the unit and the band of the cell,
 * the filters of the table and the instant the table was judged at (`asOf`). The data may still change between the
 * two calls; the screen then SAYS the figures changed and offers to take a new instant for both.
 *
 * Rolled up ("Gộp lên tổ cha") the band columns are sums over a top unit and everything under it. Such a sum is the
 * work of SEVERAL units, so it is not a link (the list is asked per unit): un-roll to open a unit's own number.
 * `holding` counts distinct records, which two units may share, so a rolled-up row gives it as "≥" a lower bound.
 *
 * The filters, the roll-up and the chosen cell live in the address; the instant does not.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Download, RefreshCw, ShieldOff, Table2, X } from 'lucide-react';
import { ListPageShell, useListPageUrlState } from '@/components/shared/ListPageShell';
import { parseBlobError } from '@/features/document-templates/export.api';
import { A11Y_FOCUS_RING, BTN_SECONDARY } from '@/constants/styles';
import { formatVNTime } from '@/lib/dates';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { TONE_CLASS, bandLabel, bandTone } from '../bandPresenter';
import { RECORD_KINDS } from '../codes';
import { FeatureOffState } from '../components/FeatureOffState';
import { explainError, isFeatureOff } from '../errors';
import { TrackingItemsTable } from '../tracking/TrackingItemsTable';
import { dueText } from '../tracking/trackingKeys';
import type { RecordKind } from '../types';
import { backlogApi } from './api';
import { BACKLOG_PAGE_SIZE, BACKLOG_QUERY_KEYS, BACKLOG_URL_PREFIX, dayParam, monthOf } from './backlogKeys';
import { OnTimeSection } from './OnTimeSection';
import { rollUp, treeOrder } from './tree';
import { BACKLOG_BANDS, DEFAULT_ROLE, WORK_ROLES, type BacklogBand, type BacklogCell, type BacklogFilters, type BandCounts } from './types';

const T = L.backlog;

const SELECT = 'rounded border border-slate-300 bg-white px-3 py-2 text-sm';
const LINK = `text-sm text-blue-700 hover:underline ${A11Y_FOCUS_RING}`;
const TH = 'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600';
const TD = 'px-3 py-2 text-sm tabular-nums text-slate-800';
const CHIP = 'inline-flex min-w-[2.25rem] items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold';

const count = (value: number) => value.toLocaleString('vi-VN');

/** What the table shows for one unit, plain or rolled up. */
interface DisplayRow extends BandCounts {
  teamId: string;
  teamName: string;
  depth: number;
  /** Units summed into this row besides itself; 0: the numbers are the unit's own and open its rows. */
  descendants: number;
  holding: number;
  holdingIsLowerBound: boolean;
  oldestDueAt: string | null;
  oldestDays: number | null;
}

function oldestText(dueAt: string | null, days: number | null): string {
  if (dueAt === null) return T.none;
  return days !== null && days > 0 ? `${dueText(dueAt)} · ${T.overdueDays(days)}` : dueText(dueAt);
}

export default function BacklogPage() {
  const url = useListPageUrlState(BACKLOG_URL_PREFIX);

  const askedKind = url.getParam('kind');
  const kind: RecordKind | null = RECORD_KINDS.find((k) => k === askedKind) ?? null;
  const askedRole = url.getParam('role');
  const role = WORK_ROLES.find((r) => r === askedRole) ?? DEFAULT_ROLE;
  const from = dayParam(url.getParam('from'));
  const to = dayParam(url.getParam('to'));
  const rolledUp = url.getParam('rollup') === '1';
  const cellTeam = url.getParam('team');
  const askedBand = url.getParam('band');
  const cellBand: BacklogBand | null = BACKLOG_BANDS.find((b) => b === askedBand) ?? null;
  const page = Math.max(1, url.getNumberParam('page', 1));
  const month = useMemo(() => monthOf(), []);
  const askedPeriodFrom = dayParam(url.getParam('period_from'));
  const askedPeriodTo = dayParam(url.getParam('period_to'));

  const filters: BacklogFilters = useMemo(() => ({ kind, role, from, to }), [kind, role, from, to]);
  const cell: BacklogCell | null = useMemo(() => (cellTeam && cellBand ? { teamId: cellTeam, band: cellBand } : null), [cellTeam, cellBand]);

  const unitsQ = useQuery({
    queryKey: BACKLOG_QUERY_KEYS.units(filters),
    queryFn: () => backlogApi.units(filters),
    staleTime: 30_000,
    retry: false,
  });
  /** The instant everything on the screen is judged at; none until the table answered. */
  const asOf = unitsQ.data?.asOf ?? null;

  const itemsQ = useQuery({
    queryKey: BACKLOG_QUERY_KEYS.cell(filters, cell, page, asOf ?? ''),
    queryFn: () => backlogApi.cellItems({ ...filters, teamId: cell?.teamId ?? '', band: cell?.band ?? 'NONE', asOf: asOf ?? '', page, pageSize: BACKLOG_PAGE_SIZE }),
    enabled: asOf !== null && cell !== null,
    retry: false,
  });

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const table = unitsQ.data ?? null;
  const display: DisplayRow[] = useMemo(() => {
    if (table === null) return [];
    if (rolledUp) return rollUp(table.rows).map((row) => ({ ...row, depth: 0 }));
    return treeOrder(table.rows).map(({ row, depth }) => ({ ...row, depth, descendants: 0, holdingIsLowerBound: false }));
  }, [table, rolledUp]);

  const cellUnit = cell && table ? (table.rows.find((r) => r.teamId === cell.teamId) ?? null) : null;
  /** What the table promises for the open cell: the number that was clicked, as the table now on screen has it. */
  const promised = cell === null || table === null ? null : cellUnit ? cellUnit[cell.band] : 0;
  const list = cell === null ? null : (itemsQ.data ?? null);
  const rows = list?.items ?? [];
  const total = list?.total ?? 0;
  /** The rows no longer are what the number said: something was finished, or came due, between the two calls. */
  const changed = list !== null && !itemsQ.isFetching && !unitsQ.isFetching && promised !== null && list.total !== promised;

  /** The page asked for ran out (the list shrank, or a link named a page that does not exist): back to the first. */
  const ranOut = list !== null && !itemsQ.isFetching && page > 1 && rows.length === 0;
  const { setParam } = url;
  useEffect(() => {
    if (ranOut) setParam('page', null);
  }, [ranOut, setParam]);

  /** Any change of what is counted starts the open cell again at its first page. */
  const setFilter = (updates: Record<string, string | null>) => url.setParams({ ...updates, page: null });
  // Opening a cell is a deliberate step people expect Back to undo.
  const openCell = (next: BacklogCell | null) =>
    url.setParams({ team: next?.teamId ?? null, band: next?.band ?? null, page: null }, { history: 'push' });
  /** A new instant for the table and, through it, for the rows of the open cell. */
  const refresh = () => {
    if (page > 1) url.setParam('page', null);
    void unitsQ.refetch();
  };

  const exportExcel = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await backlogApi.exportUnits(filters, asOf);
    } catch (err) {
      setExportError(explainError(await parseBlobError(err)).message || T.exportFailed);
    } finally {
      setExporting(false);
    }
  };

  if (unitsQ.isError && isFeatureOff(unitsQ.error)) return <FeatureOffState body={L.recordTabs.off} />;

  const unitsError = unitsQ.isError ? explainError(unitsQ.error) : null;
  const listError = itemsQ.isError ? explainError(itemsQ.error) : null;
  const forbidden = unitsError?.status === 403 || listError?.status === 403;
  const hasFilters = kind !== null || role !== DEFAULT_ROLE || from !== null || to !== null;

  const numberCell = (row: DisplayRow, band: BacklogBand) => {
    const value = row[band];
    const tone = TONE_CLASS[bandTone(band)];
    const testId = `backlog-cell-${row.teamId}-${band}`;
    // Nothing to open behind a zero; a rolled-up sum is the work of several units and the list is asked per unit.
    if (value === 0 || row.descendants > 0) {
      return (
        <span data-testid={testId} className={value === 0 ? 'text-slate-400' : `${CHIP} ${tone}`}>
          {count(value)}
        </span>
      );
    }
    const open = cell !== null && cell.teamId === row.teamId && cell.band === band;
    return (
      <button
        type="button"
        data-testid={testId}
        aria-pressed={open}
        aria-label={T.openCell(row.teamName, bandLabel(band), value)}
        className={`${CHIP} ${tone} hover:underline ${open ? 'ring-2 ring-blue-600 ring-offset-1' : ''} ${A11Y_FOCUS_RING}`}
        onClick={() => openCell(open ? null : { teamId: row.teamId, band })}
      >
        {count(value)}
      </button>
    );
  };

  return (
    <div data-testid="processing-backlog-page">
      <ListPageShell>
        <ListPageShell.Header
          icon={Table2}
          title={T.title}
          subtitle={T.subtitle}
          actions={
            !forbidden && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="backlog-export"
                  className={`${BTN_SECONDARY} inline-flex items-center gap-2`}
                  disabled={exporting || table === null}
                  onClick={() => void exportExcel()}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {exporting ? T.exporting : T.export}
                </button>
                <button
                  type="button"
                  data-testid="backlog-reload"
                  aria-label={T.refresh}
                  title={T.refresh}
                  className={`${BTN_SECONDARY} inline-flex items-center`}
                  onClick={refresh}
                >
                  <RefreshCw className={`h-4 w-4 ${unitsQ.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
                </button>
              </div>
            )
          }
        />

        {forbidden ? (
          <div data-testid="backlog-forbidden" role="alert" className="m-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <ShieldOff className="h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden="true" />
            <p className="flex-1 text-sm text-amber-900">{T.forbidden}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 border-y border-slate-200 bg-white px-4 py-3">
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
                {T.filters.kind}
                <select data-testid="backlog-filter-kind" className={SELECT} value={kind ?? ''} onChange={(e) => setFilter({ kind: e.target.value || null })}>
                  <option value="">{T.filters.all}</option>
                  {RECORD_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {L.recordKinds[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
                {T.filters.role}
                <select
                  data-testid="backlog-filter-role"
                  className={SELECT}
                  value={role}
                  onChange={(e) => setFilter({ role: e.target.value === DEFAULT_ROLE ? null : e.target.value })}
                >
                  {WORK_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {T.roles[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
                {T.filters.from}
                <input
                  type="date"
                  data-testid="backlog-filter-from"
                  className={SELECT}
                  value={from ?? ''}
                  max={to ?? undefined}
                  onChange={(e) => setFilter({ from: e.target.value || null })}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
                {T.filters.to}
                <input
                  type="date"
                  data-testid="backlog-filter-to"
                  className={SELECT}
                  value={to ?? ''}
                  min={from ?? undefined}
                  onChange={(e) => setFilter({ to: e.target.value || null })}
                />
              </label>
              <label className="flex items-center gap-2 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  data-testid="backlog-rollup"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={rolledUp}
                  onChange={(e) => url.setParam('rollup', e.target.checked ? '1' : null)}
                />
                {T.rollUp}
              </label>
              {hasFilters && (
                <button
                  type="button"
                  data-testid="backlog-clear-filters"
                  className={`${LINK} py-2`}
                  onClick={() => setFilter({ kind: null, role: null, from: null, to: null })}
                >
                  {T.filters.clear}
                </button>
              )}
            </div>

            {exportError && (
              <p data-testid="backlog-export-error" role="alert" className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {exportError}
              </p>
            )}

            {unitsError ? (
              <div data-testid="backlog-load-error" role="alert" className="m-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
                <p className="min-w-0 flex-1 text-sm text-red-700">{unitsError.message || L.common.loadFailed}</p>
                <button type="button" data-testid="backlog-retry" className={BTN_SECONDARY} onClick={refresh}>
                  {L.common.retry}
                </button>
              </div>
            ) : table === null ? (
              <p data-testid="backlog-loading" role="status" className="px-4 py-6 text-sm text-slate-500">
                {L.common.loading}
              </p>
            ) : table.rows.length === 0 ? (
              <div data-testid="backlog-empty" className="m-4 rounded-lg border border-slate-200 bg-white p-8 text-center">
                <p className="text-sm font-medium text-slate-700">{T.empty}</p>
                {hasFilters && <p className="mt-1 text-sm text-slate-500">{T.emptyHint}</p>}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
                  <p className="text-xs text-slate-500">{rolledUp ? T.rollUpNote : T.scopeNote}</p>
                  {asOf && (
                    <p data-testid="backlog-as-of" className="text-xs text-slate-500">
                      {L.tracking.asOf(formatVNTime(asOf))}
                    </p>
                  )}
                </div>
                <div className="overflow-x-auto" data-testid="backlog-table-scroll">
                  <table aria-label={T.tableTitle} data-testid="backlog-table" className="w-full min-w-[900px] border-collapse bg-white">
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className={`${TH} text-left`}>
                          {T.columns.unit}
                        </th>
                        <th scope="col" className={`${TH} text-right`} title={T.holdingHint}>
                          {T.columns.holding}
                        </th>
                        {BACKLOG_BANDS.map((band) => (
                          <th key={band} scope="col" className={`${TH} text-right`}>
                            {bandLabel(band)}
                          </th>
                        ))}
                        <th scope="col" className={`${TH} text-left`}>
                          {T.columns.oldest}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {display.map((row) => (
                        <tr key={row.teamId} data-testid={`backlog-row-${row.teamId}`} className="border-t border-slate-200">
                          <th scope="row" className={`${TD} text-left font-medium`} style={{ paddingLeft: `${0.75 + row.depth * 1.25}rem` }}>
                            {row.teamName}
                            {row.descendants > 0 && <span className="ml-2 text-xs font-normal text-slate-500">{T.childUnits(row.descendants)}</span>}
                          </th>
                          <td
                            className={`${TD} text-right`}
                            data-testid={`backlog-holding-${row.teamId}`}
                            title={row.holdingIsLowerBound ? T.atLeastHint : undefined}
                          >
                            {row.holdingIsLowerBound ? T.atLeast(row.holding) : count(row.holding)}
                          </td>
                          {BACKLOG_BANDS.map((band) => (
                            <td key={band} className={`${TD} text-right`}>
                              {numberCell(row, band)}
                            </td>
                          ))}
                          <td className={`${TD} whitespace-nowrap text-left`} data-testid={`backlog-oldest-${row.teamId}`}>
                            {oldestText(row.oldestDueAt, row.oldestDays)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr data-testid="backlog-totals" className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                        <th scope="row" className={`${TD} text-left`}>
                          {T.totals}
                        </th>
                        <td className={`${TD} text-right`}>{count(table.totals.holding)}</td>
                        {BACKLOG_BANDS.map((band) => (
                          <td key={band} className={`${TD} text-right`} data-testid={`backlog-total-${band}`}>
                            {count(table.totals[band])}
                          </td>
                        ))}
                        <td className={TD} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}

            {cell !== null && !unitsError && table !== null && (
              <section data-testid="backlog-cell-panel" aria-labelledby="backlog-cell-title" className="mt-4 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 id="backlog-cell-title" className="text-sm font-semibold text-slate-800">
                      {T.cell.title(cellUnit?.teamName ?? T.cell.unknownUnit, bandLabel(cell.band))}
                    </h2>
                    {list !== null && !listError && (
                      <b data-testid="backlog-cell-count" className="text-sm text-slate-800">
                        {T.cell.count(total)}
                      </b>
                    )}
                    <button type="button" data-testid="backlog-cell-close" className={`${LINK} inline-flex items-center gap-1`} onClick={() => openCell(null)}>
                      <X className="h-4 w-4" aria-hidden="true" />
                      {T.cell.close}
                    </button>
                  </div>
                  {asOf && changed && (
                    <p data-testid="backlog-changed" role="status" className="flex flex-wrap items-center gap-2 text-xs text-amber-800">
                      {L.tracking.changed(formatVNTime(asOf))}
                      <button type="button" data-testid="backlog-refresh" className={`${LINK} !text-xs font-semibold`} onClick={refresh}>
                        {T.refresh}
                      </button>
                    </p>
                  )}
                </div>
                {listError ? (
                  <div data-testid="backlog-list-error" role="alert" className="m-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
                    <p className="min-w-0 flex-1 text-sm text-red-700">{listError.message || L.common.loadFailed}</p>
                    <button type="button" data-testid="backlog-list-retry" className={BTN_SECONDARY} onClick={() => void itemsQ.refetch()}>
                      {L.common.retry}
                    </button>
                  </div>
                ) : (
                  <TrackingItemsTable
                    loading={list === null || itemsQ.isFetching || ranOut}
                    rows={rows}
                    total={total}
                    page={page}
                    pageSize={BACKLOG_PAGE_SIZE}
                    onPageChange={(next) => url.setParam('page', next > 1 ? String(next) : null)}
                    title={T.cell.tableTitle}
                    emptyTitle={T.cell.empty}
                  />
                )}
              </section>
            )}

            <OnTimeSection
              kind={kind}
              role={role}
              from={askedPeriodFrom ?? month.from}
              to={askedPeriodTo ?? month.to}
              customPeriod={askedPeriodFrom !== null || askedPeriodTo !== null}
              onPeriodChange={(updates) =>
                url.setParams({
                  ...('from' in updates ? { period_from: updates.from ?? null } : {}),
                  ...('to' in updates ? { period_to: updates.to ?? null } : {}),
                })
              }
            />
          </>
        )}
      </ListPageShell>
    </div>
  );
}
