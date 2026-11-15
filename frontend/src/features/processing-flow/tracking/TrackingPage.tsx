/**
 * /theo-doi-xu-ly — "Theo dõi xử lý": the work (a step × the unit that works it) in an alert band. Four cards with
 * the counts, and under them the list; clicking a card lists that band, clicking it again lists every colour.
 *
 * The number on a card equals the rows of its list because both are judged at ONE instant: the summary answers the
 * instant it used (`asOf`) and every list call passes it back. The data may still change between the two calls (a
 * step is finished meanwhile); the screen then SAYS the figures of hh:mm changed and offers to take a new instant
 * for both, rather than show a number that disagrees with its rows.
 *
 * The card and the filters live in the address (a link can be shared, Back works); the instant does not (a link
 * opened tomorrow must be judged tomorrow).
 */
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, CheckCircle2, Clock, RefreshCw, ShieldOff, type LucideIcon } from 'lucide-react';
import { ListPageShell, useListPageUrlState, type ColumnDef } from '@/components/shared/ListPageShell';
import { StatsCardsStrip, type StatCard } from '@/components/shared/StatsCardsStrip';
import { A11Y_FOCUS_RING, BTN_SECONDARY } from '@/constants/styles';
import { formatVNTime } from '@/lib/dates';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { TONE_CARD_CLASS, TONE_CLASS, bandLabel, bandText, bandTone } from '../bandPresenter';
import { RECORD_KINDS } from '../codes';
import { FeatureOffState } from '../components/FeatureOffState';
import { explainError, isFeatureOff } from '../errors';
import { recordTabHref } from '../record-tabs/recordLink';
import type { RecordKind } from '../types';
import { useTeamChoices } from '../useTeamChoices';
import { trackingApi } from './api';
import { TRACKING_PAGE_SIZE, TRACKING_QUERY_KEYS, TRACKING_URL_PREFIX, dueText } from './trackingKeys';
import { TRACKED_BANDS, type TrackedBand, type TrackingFilters, type TrackingItemDto } from './types';

const T = L.tracking;

/** The icon of each card. Its NAME and its colours come from the one band presenter. */
const CARD_ICON: Record<TrackedBand, LucideIcon> = { OVERDUE: AlertOctagon, RED: AlertTriangle, YELLOW: Clock, GREEN: CheckCircle2 };

const SELECT = 'rounded border border-slate-300 bg-white px-3 py-2 text-sm';
const LINK = `text-sm text-blue-700 hover:underline ${A11Y_FOCUS_RING}`;

/** One row per piece of work: the id the server gives it. Record + step is NOT unique (a step may have two MAIN parties). */
const rowId = (item: TrackingItemDto): string => item.id;

export default function TrackingPage() {
  const url = useListPageUrlState(TRACKING_URL_PREFIX);
  const teamsQ = useTeamChoices();

  const askedBand = url.getParam('band');
  const band = TRACKED_BANDS.find((b) => b === askedBand) ?? null;
  const askedKind = url.getParam('kind');
  const kind: RecordKind | null = RECORD_KINDS.find((k) => k === askedKind) ?? null;
  const teamId = url.getParam('team');
  const mine = url.getParam('mine') === '1';
  const page = Math.max(1, url.getNumberParam('page', 1));

  const filters: TrackingFilters = useMemo(() => ({ mine, teamId, kind }), [mine, teamId, kind]);

  const summaryQ = useQuery({
    queryKey: TRACKING_QUERY_KEYS.summary(filters),
    queryFn: () => trackingApi.summary(filters),
    staleTime: 30_000,
    retry: false,
  });
  /** The instant everything on the screen is judged at; none until the cards answered. */
  const asOf = summaryQ.data?.asOf ?? null;

  const itemsQ = useQuery({
    queryKey: TRACKING_QUERY_KEYS.items(filters, band, page, asOf ?? ''),
    queryFn: () => trackingApi.items({ ...filters, band, asOf: asOf ?? '', page, pageSize: TRACKING_PAGE_SIZE }),
    enabled: asOf !== null,
    retry: false,
  });

  const counts = summaryQ.data?.counts ?? null;
  /** Records whose flow is only a proposal: counted apart from the cards. An older server does not say. */
  const unconfirmed = summaryQ.data?.unconfirmed ?? 0;
  const cards: StatCard[] = TRACKED_BANDS.map((b) => ({
    label: bandLabel(b),
    value: counts ? counts[b] : null,
    filterValue: b,
    testId: `tracking-card-${b}`,
    icon: CARD_ICON[b],
    ...TONE_CARD_CLASS[bandTone(b)],
  }));

  /** What the cards promise for the list on screen: the chosen card, or the four together when none is chosen. */
  const promised = counts === null ? null : band ? counts[band] : TRACKED_BANDS.reduce((sum, b) => sum + counts[b], 0);
  const list = itemsQ.data ?? null;
  const rows = list?.items ?? [];
  const total = list?.total ?? 0;
  /** The rows no longer are what the card said: something was finished, or came due, between the two calls. */
  const changed = list !== null && !itemsQ.isFetching && !summaryQ.isFetching && promised !== null && list.total !== promised;

  /**
   * The page asked for ran out behind our back (the list shrank while we were on it, or a link names a page past the
   * end): no rows although the total says there are some. Go back to the first page instead of showing an empty table.
   */
  const ranOut = list !== null && !itemsQ.isFetching && page > 1 && list.items.length === 0 && list.total > 0;
  const { setParam } = url;
  useEffect(() => {
    if (ranOut) setParam('page', null);
  }, [ranOut, setParam]);

  /** Any change of what is listed starts again at the first page: the page key is REMOVED, not set to 1. */
  const setFilter = (updates: Record<string, string | null>) => url.setParams({ ...updates, page: null });
  // A card is a deliberate step people expect Back to undo; a filter is a refinement and replaces.
  const selectCard = (value: string | null) => url.setParams({ band: value, page: null }, { history: 'push' });
  /**
   * A new instant for the cards and the list. It starts again at the first page: the page being looked at may not
   * exist any more once the figures are new (page 3 of a list that shrank to one page is an empty table).
   */
  const refresh = () => {
    if (page > 1) url.setParam('page', null);
    void summaryQ.refetch();
  };

  const columns: ColumnDef<TrackingItemDto>[] = [
    {
      key: 'alert',
      header: T.columns.alert,
      width: '11rem',
      render: (item) => (
        <span
          data-testid="tracking-band"
          className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[bandTone(item.band)]}`}
        >
          {bandText(item.band, item.remainingDays)}
        </span>
      ),
    },
    {
      key: 'record',
      header: T.columns.record,
      width: '15rem',
      render: (item) => {
        const code = item.recordCode ?? T.noCode;
        return (
          <div className="min-w-0">
            <Link
              to={recordTabHref(item.recordKind, item.recordId)}
              aria-label={T.open(code)}
              className={`font-semibold text-blue-800 hover:underline ${A11Y_FOCUS_RING}`}
            >
              {code}
            </Link>
            {item.recordLabel && <span className="text-slate-700"> · {item.recordLabel}</span>}
            <div className="text-xs text-slate-500">{L.recordKinds[item.recordKind] ?? item.recordKind}</div>
          </div>
        );
      },
    },
    { key: 'step', header: T.columns.step, width: '12rem', render: (item) => item.stepName },
    {
      key: 'unit',
      header: T.columns.unit,
      width: '14rem',
      render: (item) =>
        item.responsibleName ? (
          `${item.teamName ?? T.noUnit} · ${item.responsibleName}`
        ) : (
          <>
            {item.teamName ?? T.noUnit}
            <div className="text-xs text-slate-500">{T.noPerson}</div>
          </>
        ),
    },
    {
      key: 'due',
      header: T.columns.due,
      width: '9rem',
      cellClassName: 'px-4 py-3 align-top text-sm text-slate-800 tabular-nums',
      render: (item) => dueText(item.dueAt),
    },
  ];

  if (summaryQ.isError && isFeatureOff(summaryQ.error)) return <FeatureOffState body={L.recordTabs.off} />;

  const summaryError = summaryQ.isError ? explainError(summaryQ.error) : null;
  const listError = itemsQ.isError ? explainError(itemsQ.error) : null;
  const forbidden = summaryError?.status === 403 || listError?.status === 403;
  const hasFilters = band !== null || mine || teamId !== null || kind !== null;

  const teams = teamsQ.data ?? [];
  const teamKnown = teamId === null || teams.some((t) => t.id === teamId);

  return (
    <div data-testid="processing-tracking-page">
      <ListPageShell>
        <ListPageShell.Header
          icon={Activity}
          title={T.title}
          subtitle={T.subtitle}
          actions={
            !forbidden && (
              <button
                type="button"
                data-testid="tracking-reload"
                aria-label={T.refresh}
                title={T.refresh}
                className={`${BTN_SECONDARY} inline-flex items-center`}
                onClick={refresh}
              >
                <RefreshCw className={`h-4 w-4 ${summaryQ.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            )
          }
        />

        {forbidden ? (
          <div data-testid="tracking-forbidden" role="alert" className="m-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <ShieldOff className="h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden="true" />
            <p className="flex-1 text-sm text-amber-900">{T.forbidden}</p>
          </div>
        ) : summaryError ? (
          <div data-testid="tracking-load-error" role="alert" className="m-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm text-red-700">{summaryError.message || L.common.loadFailed}</p>
            <button type="button" data-testid="tracking-retry" className={BTN_SECONDARY} onClick={refresh}>
              {L.common.retry}
            </button>
          </div>
        ) : (
          <>
            <StatsCardsStrip
              cards={cards}
              loading={counts === null}
              activeValue={band}
              onCardSelect={selectCard}
              allowDeselect
              gridClassName="grid grid-cols-2 gap-3 px-4 py-4 md:grid-cols-4"
            />
            {unconfirmed > 0 && (
              <p data-testid="tracking-unconfirmed" className="-mt-2 px-4 pb-3 text-sm text-slate-600">
                {T.unconfirmed(unconfirmed)}
              </p>
            )}

            <div className="flex flex-wrap items-end gap-3 border-y border-slate-200 bg-white px-4 py-3">
              <div role="group" aria-label={T.scope.label} className="inline-flex overflow-hidden rounded-lg border border-slate-300">
                {(
                  [
                    ['mine', true, T.scope.mine],
                    ['all', false, T.scope.all],
                  ] as const
                ).map(([id, value, label]) => (
                  <button
                    key={id}
                    type="button"
                    data-testid={`tracking-scope-${id}`}
                    aria-pressed={mine === value}
                    onClick={() => setFilter({ mine: value ? '1' : null })}
                    className={`border-l border-slate-300 px-3 py-2 text-sm font-medium first:border-l-0 ${
                      mine === value ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                    } ${A11Y_FOCUS_RING}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
                {T.filters.kind}
                <select
                  data-testid="tracking-filter-kind"
                  className={SELECT}
                  value={kind ?? ''}
                  onChange={(e) => setFilter({ kind: e.target.value || null })}
                >
                  <option value="">{T.filters.all}</option>
                  {RECORD_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {L.recordKinds[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
                {T.filters.team}
                <select
                  data-testid="tracking-filter-team"
                  className={`${SELECT} max-w-[16rem]`}
                  value={teamId ?? ''}
                  onChange={(e) => setFilter({ team: e.target.value || null })}
                >
                  <option value="">{T.filters.all}</option>
                  {/* A unit named by a shared link that the picker does not list still shows as the one being filtered. */}
                  {!teamKnown && teamId && <option value={teamId}>{T.filters.unknownTeam}</option>}
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {hasFilters && (
                <button type="button" data-testid="tracking-clear-filters" className={`${LINK} py-2`} onClick={() => url.clearAll()}>
                  {T.filters.clear}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {list !== null && !listError && (
                  <b data-testid="tracking-count" className="text-sm text-slate-800">
                    {band ? T.countByCard(total, bandLabel(band)) : T.count(total)}
                  </b>
                )}
                {band && (
                  <button type="button" data-testid="tracking-clear-card" className={LINK} onClick={() => selectCard(null)}>
                    {T.clearCard}
                  </button>
                )}
              </div>
              {asOf &&
                (changed ? (
                  <p data-testid="tracking-changed" role="status" className="flex flex-wrap items-center gap-2 text-xs text-amber-800">
                    {T.changed(formatVNTime(asOf))}
                    <button type="button" data-testid="tracking-refresh" className={`${LINK} !text-xs font-semibold`} onClick={refresh}>
                      {T.refresh}
                    </button>
                  </p>
                ) : (
                  <p data-testid="tracking-as-of" className="text-xs text-slate-500">
                    {T.asOf(formatVNTime(asOf))}
                  </p>
                ))}
            </div>

            {listError ? (
              <div data-testid="tracking-list-error" role="alert" className="m-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
                <p className="min-w-0 flex-1 text-sm text-red-700">{listError.message || L.common.loadFailed}</p>
                <button type="button" data-testid="tracking-list-retry" className={BTN_SECONDARY} onClick={() => void itemsQ.refetch()}>
                  {L.common.retry}
                </button>
              </div>
            ) : (
              <>
                <ListPageShell.Table<TrackingItemDto>
                  state={list === null || itemsQ.isFetching || ranOut ? 'loading' : rows.length === 0 ? 'empty' : 'ready'}
                  fixedLayout
                  xuongDong
                  columns={columns}
                  data={rows}
                  rowKey={rowId}
                  title={T.tableTitle}
                  totalCount={total}
                  emptyState={{ title: T.empty, description: hasFilters ? T.emptyHint : undefined }}
                  rowHref={(item) => recordTabHref(item.recordKind, item.recordId)}
                  rowTestId={(item) => `tracking-row-${rowId(item)}`}
                />
                <ListPageShell.Pagination
                  page={page}
                  totalPages={Math.max(1, Math.ceil(total / TRACKING_PAGE_SIZE))}
                  totalCount={total}
                  onPageChange={(next) => url.setParam('page', next > 1 ? String(next) : null)}
                />
              </>
            )}
          </>
        )}
      </ListPageShell>
    </div>
  );
}
