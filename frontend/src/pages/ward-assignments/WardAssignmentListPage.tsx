/**
 * /ho-so-phan-cong — the ward assignment requests the person may read (the server applies the reach): status cards
 * that filter, a search box (code or summary), the ten default columns of the plan, more by the column picker.
 *
 * A row opens through the link in its "Mã" cell, not by a click on the row: a row click goes through `useBamDong`,
 * whose behaviour is a system setting per screen (`MAN_BAM_DONG` + a backend `BAM_DONG_*` key) this screen has none of.
 */
import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Archive, CheckCircle, ClipboardList, FileEdit, Inbox, Search, Undo2, Layers } from 'lucide-react';
import { ListPageShell, ColumnPicker, useBoCucCot, type ColumnDef } from '@/components/shared/ListPageShell';
import { StatsCardsStrip, type StatCard } from '@/components/shared/StatsCardsStrip';
import { A11Y_FOCUS_RING, BTN_PRIMARY, BTN_SECONDARY, INPUT_BASE } from '@/constants/styles';
import { formatVNDate } from '@/lib/dates';
import { usePermission } from '@/hooks/usePermission';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { wardAssignmentsApi, WARD_QUERY_KEYS } from '@/features/ward-assignments/api';
import { WARD_PATHS } from '@/features/ward-assignments/menu';
import { displayStatus, formatDay } from '@/features/ward-assignments/formModel';
import { WARD_STATUSES, type WardAssignmentRow, type WardListQuery, type WardStatus } from '@/features/ward-assignments/types';
import { WardStatusBadge } from '@/features/ward-assignments/components/WardStatusBadge';

const PAGE_SIZE = 50;
/** URL keys, prefixed so that they never collide with another screen's (`hspc_page` is cleared with the filters). */
const P = { card: 'hspc_the', q: 'hspc_q', page: 'hspc_page' } as const;

type CardKey = 'all' | WardStatus | 'archived';
const CARD_KEYS: readonly CardKey[] = ['all', ...WARD_STATUSES, 'archived'];

function queryOfCard(card: CardKey, q: string): WardListQuery {
  return {
    ...(q ? { q } : {}),
    ...(card === 'archived' ? { archived: true } : card === 'all' ? {} : { status: card }),
  };
}

/**
 * The "Hạn báo kết quả" cell. Lane D replaces its content by the deadline alert (`AlertBadge`, from `row.alert`);
 * until then it shows the plain due date.
 */
function ResultDueCell({ row }: { row: WardAssignmentRow }) {
  return (
    <span data-testid={`ward-due-${row.id}`} className="tabular-nums text-slate-700">
      {formatDay(row.resultDueOn)}
    </span>
  );
}

const CARD_STYLE: Record<CardKey, Pick<StatCard, 'icon' | 'iconBgClass' | 'iconColorClass' | 'valueColorClass'>> = {
  all: { icon: Layers, iconBgClass: 'bg-slate-100', iconColorClass: 'text-slate-600', valueColorClass: 'text-slate-800' },
  DRAFT: { icon: FileEdit, iconBgClass: 'bg-slate-100', iconColorClass: 'text-slate-500', valueColorClass: 'text-slate-700' },
  SUBMITTED: { icon: Inbox, iconBgClass: 'bg-blue-50', iconColorClass: 'text-blue-600', valueColorClass: 'text-blue-700' },
  RETURNED: { icon: Undo2, iconBgClass: 'bg-amber-50', iconColorClass: 'text-amber-600', valueColorClass: 'text-amber-700' },
  APPROVED: { icon: CheckCircle, iconBgClass: 'bg-green-50', iconColorClass: 'text-green-600', valueColorClass: 'text-green-700' },
  archived: { icon: Archive, iconBgClass: 'bg-slate-100', iconColorClass: 'text-slate-500', valueColorClass: 'text-slate-600' },
};

export default function WardAssignmentListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { permissions } = usePermission();
  const canCreate = permissions === null || permissions.includes('write:WardAssignment');

  const card = (CARD_KEYS as readonly string[]).includes(params.get(P.card) ?? '') ? (params.get(P.card) as CardKey) : 'all';
  const q = (params.get(P.q) ?? '').trim();
  const page = Math.max(1, Number(params.get(P.page)) || 1);
  const [typed, setTyped] = useState(q);

  const listQuery: WardListQuery = { ...queryOfCard(card, q), page, pageSize: PAGE_SIZE };
  const listQ = useQuery({
    queryKey: WARD_QUERY_KEYS.list(listQuery),
    queryFn: () => wardAssignmentsApi.list(listQuery),
    staleTime: 10_000,
    retry: false,
  });

  // One count per card, with the same search as the rows: a card's number is the number of rows it shows.
  const counts = useQueries({
    queries: CARD_KEYS.map((key) => {
      const query = { ...queryOfCard(key, q), page: 1, pageSize: 1 };
      return {
        queryKey: WARD_QUERY_KEYS.count(query),
        queryFn: () => wardAssignmentsApi.list(query),
        staleTime: 10_000,
        retry: false,
      };
    }),
  });

  const update = (next: Partial<Record<keyof typeof P, string | null>>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next) as [keyof typeof P, string | null][]) {
      if (v) p.set(P[k], v);
      else p.delete(P[k]);
    }
    setParams(p, { replace: true });
  };

  const cards: StatCard[] = CARD_KEYS.map((key, i) => ({
    label: L.list.cards[key],
    value: counts[i]?.data?.total ?? null,
    filterValue: key === 'all' ? null : key,
    testId: `ward-card-${key}`,
    ...CARD_STYLE[key],
  }));

  const C = L.list.columns;
  const columns: ColumnDef<WardAssignmentRow>[] = [
    {
      key: 'code',
      header: C.code,
      width: '9rem',
      cellClassName: 'px-3 py-3 font-medium',
      render: (r) => (
        <Link
          to={WARD_PATHS.view(r.id)}
          aria-label={L.list.open(r.code ?? L.list.noCode)}
          className={`text-blue-700 hover:underline ${A11Y_FOCUS_RING}`}
        >
          {r.code ?? <span className="italic text-slate-500">{L.list.noCode}</span>}
        </Link>
      ),
    },
    { key: 'submittedAt', header: C.submittedAt, width: '8rem', optional: 'show', cellClassName: 'px-3 py-3 tabular-nums', render: (r) => (r.submittedAt ? formatVNDate(r.submittedAt) : '') },
    { key: 'unit', header: C.unit, width: '12rem', optional: 'show', cellClassName: 'px-3 py-3', render: (r) => r.assignedTeam?.name ?? '' },
    { key: 'caseType', header: C.caseType, width: '7rem', optional: 'show', cellClassName: 'px-3 py-3', render: (r) => L.caseType[r.caseType] },
    { key: 'kind', header: C.kind, width: '6rem', optional: 'show', cellClassName: 'px-3 py-3', render: (r) => L.kind[r.kind] },
    { key: 'crime', header: C.crime, width: '12rem', optional: 'show', cellClassName: 'px-3 py-3', render: (r) => r.crime?.name ?? r.crimeOther ?? '' },
    { key: 'summary', header: C.summary, width: '18rem', optional: 'show', cellClassName: 'px-3 py-3', render: (r) => r.summary },
    { key: 'status', header: C.status, width: '10rem', optional: 'show', cellClassName: 'px-3 py-3', render: (r) => <WardStatusBadge status={displayStatus(r)} /> },
    { key: 'submissionCount', header: C.submissionCount, width: '6rem', optional: 'show', cellClassName: 'px-3 py-3 text-right tabular-nums', render: (r) => r.submissionCount },
    { key: 'resultDueOn', header: C.resultDueOn, width: '10rem', optional: 'show', cellClassName: 'px-3 py-3', render: (r) => <ResultDueCell row={r} /> },
  ];
  const { coGhiDeBeRong, visibleColumns, toggleableColumns, isVisible, batTat, datBeRong, xoaBeRong, doiCho, datLai } = useBoCucCot('ward-assignments', columns);

  const data = useMemo(() => listQ.data?.data ?? [], [listQ.data]);
  const total = listQ.data?.total ?? 0;
  const filtered = card !== 'all' || q !== '';

  const search = () => update({ q: typed.trim() || null, page: null });

  return (
    <div data-testid="ward-assignment-list-page">
      <ListPageShell>
        <ListPageShell.Header
          icon={ClipboardList}
          title={L.title}
          subtitle={L.list.hint}
          actions={
            <div className="flex items-center gap-2">
              <ColumnPicker columns={toggleableColumns} isVisible={isVisible} onToggle={batTat} onReset={datLai} onDoiCho={doiCho} />
              {canCreate && (
                <button type="button" data-testid="ward-create" className={BTN_PRIMARY} onClick={() => navigate(WARD_PATHS.create)}>
                  {L.list.create}
                </button>
              )}
            </div>
          }
        />

        <StatsCardsStrip
          cards={cards}
          activeValue={card === 'all' ? null : card}
          onCardSelect={(v) => update({ card: v, page: null })}
        />

        {/* Not a form element: a list screen is not a data-entry screen for the update-when-idle rule (`congDuongDanForm` gate). */}
        <div role="search" data-testid="ward-search-form" className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <label className="flex min-w-[18rem] flex-1 flex-col gap-1 text-sm text-slate-700">
            {L.list.searchLabel}
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                data-testid="ward-search"
                type="search"
                value={typed}
                placeholder={L.list.searchPlaceholder}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    search();
                  }
                }}
                className={`${INPUT_BASE} pl-9`}
              />
            </span>
          </label>
          <button type="button" data-testid="ward-search-go" className={BTN_SECONDARY} onClick={search}>
            {L.list.searchLabel}
          </button>
        </div>

        {listQ.isError ? (
          <div data-testid="ward-list-error" role="alert" className="m-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
            <p className="flex-1 text-sm text-red-700">{L.list.loadFailed}</p>
            <button type="button" className={BTN_SECONDARY} onClick={() => void listQ.refetch()}>
              {L.list.retry}
            </button>
          </div>
        ) : (
          <ListPageShell.Table<WardAssignmentRow>
            state={listQ.isLoading ? 'loading' : data.length === 0 ? (filtered ? 'empty-filtered' : 'empty') : 'ready'}
            fixedLayout
            onKeoGian={datBeRong}
            onVeMacDinhCot={xoaBeRong}
            datTongBeRong={coGhiDeBeRong}
            columns={visibleColumns}
            data={data}
            rowKey={(r) => r.id}
            rowTestId={(r) => `ward-row-${r.id}`}
            title={L.title}
            totalCount={total}
            emptyState={{ title: L.list.empty }}
            emptyFilteredState={{
              onClearFilters: () => {
                setTyped('');
                update({ card: null, q: null, page: null });
              },
            }}
          />
        )}
        <ListPageShell.Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          totalCount={total}
          pageSize={PAGE_SIZE}
          onPageChange={(n) => update({ page: n > 1 ? String(n) : null })}
        />
      </ListPageShell>
    </div>
  );
}
