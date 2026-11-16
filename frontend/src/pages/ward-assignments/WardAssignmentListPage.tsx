/**
 * /ho-so-phan-cong — the ward assignment requests the person may read (the server applies the reach): status cards
 * that filter, a search box (code or summary), the ten default columns of the plan, more by the column picker.
 *
 * As the petition list: "Tạo mới" with its shortcut (Alt+N; Alt+R reads again, Ctrl+K goes to the search box), and an
 * actions column first, pinned: open, edit, print the request slip, delete a draft. What a row offers is the server's
 * answer for that row (`can`), the same rules as the form.
 *
 * A row opens through its buttons or the link in its "Mã" cell, not by a click on the row: a row click goes through
 * `useBamDong`, whose behaviour is a system setting per screen (`MAN_BAM_DONG` + a backend `BAM_DONG_*` key) this
 * screen has none of.
 */
import { useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Archive, CheckCircle, ClipboardList, Eye, FileEdit, Inbox, Pencil, Plus, Printer, Search, Trash2, Undo2, Layers } from 'lucide-react';
import { ListPageShell, ColumnPicker, useBoCucCot, type ColumnDef } from '@/components/shared/ListPageShell';
import { BE_RONG_COT_THAO_TAC } from '@/components/shared/ListPageShell/cotThaoTac';
import { ConfirmModal } from '@/components/shared/Modal';
import { ShortcutHint } from '@/components/ShortcutCheatSheet';
import { RowActions } from '@/features/_shared/row-actions/RowActions';
import { createRowActionRegistry, type ActionContext } from '@/features/_shared/row-actions/registry';
import { useListShortcuts } from '@/hooks/useListShortcuts';
import { explainWardError } from '@/features/ward-assignments/errors';
import { RequestSlipDialog } from '@/features/ward-assignments/components/RequestSlipDialog';
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
import { AlertBadge } from '@/features/ward-assignments/components/AlertBadge';

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

/** The filters a number of the statistics page opens, read as the statistics page writes them (`wardListLink`). */
const DRILL_KEYS = ['submitted', 'from', 'to', 'teamId', 'crimeId', 'caseType', 'kind', 'alert'] as const;
function drillOf(params: URLSearchParams): Partial<WardListQuery> {
  const out: Record<string, string> = {};
  for (const key of DRILL_KEYS) {
    const v = params.get(key);
    if (v) out[key] = v;
  }
  return out as Partial<WardListQuery>;
}

/** The "Hạn báo kết quả" cell: the due day, coloured by the deadline alert the server judged (`row.alert`). */
function ResultDueCell({ row }: { row: WardAssignmentRow }) {
  return (
    <span data-testid={`ward-due-${row.id}`} className="inline-flex items-center gap-2 tabular-nums text-slate-700">
      {formatDay(row.resultDueOn)}
      {row.alert && row.alert.level !== 'NONE' && <AlertBadge alert={row.alert} />}
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

/** The modals of the record lists (assign, delete with a reason, print documents) are not this screen's: its own are below. */
const NO_MODAL = { open: () => undefined };

export default function WardAssignmentListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { permissions } = usePermission();
  const canCreate = permissions === null || permissions.includes('write:WardAssignment');
  const [slipOf, setSlipOf] = useState<WardAssignmentRow | null>(null);
  const [deleting, setDeleting] = useState<WardAssignmentRow | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // A number of the statistics page opens the list with its status: that is the card shown, unless one is chosen.
  const cardParam = params.get(P.card) ?? params.get('status') ?? '';
  const card = (CARD_KEYS as readonly string[]).includes(cardParam) ? (cardParam as CardKey) : 'all';
  const drill = drillOf(params);
  const drilled = Object.keys(drill).length > 0;
  const q = (params.get(P.q) ?? '').trim();
  const page = Math.max(1, Number(params.get(P.page)) || 1);
  const [typed, setTyped] = useState(q);

  const listQuery: WardListQuery = { ...queryOfCard(card, q), ...drill, page, pageSize: PAGE_SIZE };
  const listQ = useQuery({
    queryKey: WARD_QUERY_KEYS.list(listQuery),
    queryFn: () => wardAssignmentsApi.list(listQuery),
    staleTime: 10_000,
    retry: false,
  });

  // One count per card, with the same search as the rows: a card's number is the number of rows it shows.
  const counts = useQueries({
    queries: CARD_KEYS.map((key) => {
      const query = { ...queryOfCard(key, q), ...drill, page: 1, pageSize: 1 };
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
    // A card chosen replaces the status a number of the statistics page opened with.
    if ('card' in next) p.delete('status');
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

  const refresh = () => qc.invalidateQueries({ queryKey: WARD_QUERY_KEYS.all });
  useListShortcuts({
    onNew: canCreate ? () => navigate(WARD_PATHS.create) : undefined,
    onRefresh: () => void refresh(),
  });

  const T = L.list.actions;
  // Built here, not at module level: the print and delete actions open this screen's own dialogs.
  const rowActions = useMemo(
    () =>
      createRowActionRegistry<WardAssignmentRow>().registerMany([
        { key: 'view', label: T.view, icon: Eye, position: 'inline', execute: (row, ctx) => ctx.navigate(WARD_PATHS.view(row.id)), testid: 'btn-view' },
        { key: 'edit', label: T.edit, icon: Pencil, position: 'inline', visible: (row) => !!row.can?.edit, execute: (row, ctx) => ctx.navigate(WARD_PATHS.edit(row.id)), testid: 'btn-edit' },
        {
          key: 'print',
          label: T.print,
          icon: Printer,
          position: 'inline',
          // A decision of PC02 to print the slip of: PC02 issues it, whoever reads the request saves an issued one.
          visible: (row) => !!row.latestDecision && (!!row.can?.issueSlip || !!row.latestDecision.slipNumber),
          execute: (row) => setSlipOf(row),
          testid: 'btn-print',
        },
        { key: 'delete', label: T.delete, icon: Trash2, position: 'inline', danger: true, visible: (row) => !!row.can?.delete, execute: (row) => setDeleting(row), testid: 'btn-delete' },
      ]),
    [T],
  );
  const actionCtx: ActionContext = { navigate, perms: {}, assignModal: NO_MODAL, deleteModal: NO_MODAL, printModal: NO_MODAL };

  const confirmDelete = async () => {
    const row = deleting;
    if (!row) return;
    setDeleting(null);
    try {
      await wardAssignmentsApi.remove(row.id, row.updatedAt);
      setNotice({ kind: 'ok', text: L.list.deleted });
    } catch (err) {
      setNotice({ kind: 'error', text: explainWardError(err).message });
    }
    await refresh();
  };

  const C = L.list.columns;
  const columns: ColumnDef<WardAssignmentRow>[] = [
    {
      key: 'actions',
      header: T.column,
      width: BE_RONG_COT_THAO_TAC,
      thuGonTrenDienThoai: true,
      // Not the person's to resize: the buttons are of a fixed size and their number is ours.
      khongDoiBeRong: true,
      sticky: true,
      render: (r) => <RowActions registry={rowActions} row={r} ctx={actionCtx} tieuDe={T.sheetTitle(r.code ?? L.list.noCode)} />,
    },
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
                <button type="button" data-testid="ward-create" className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} flex items-center gap-2`} onClick={() => navigate(WARD_PATHS.create)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{L.list.create}</span>
                  <ShortcutHint action="newRecord" className="ml-1" />
                </button>
              )}
            </div>
          }
        />

        {drilled && (
          <div data-testid="ward-drill" className="flex flex-wrap items-center gap-3 border-b border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-800">
            <span className="flex-1">{L.list.drill.active}</span>
            <button
              type="button"
              data-testid="ward-drill-clear"
              className={BTN_SECONDARY}
              onClick={() => {
                const p = new URLSearchParams(params);
                for (const key of [...DRILL_KEYS, 'status']) p.delete(key);
                p.delete(P.page);
                setParams(p, { replace: true });
              }}
            >
              {L.list.drill.clear}
            </button>
          </div>
        )}

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
                // The role the list shortcut (Ctrl+K) looks for.
                role="searchbox"
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

        {notice && (
          <div
            data-testid="ward-list-notice"
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={`flex items-center gap-3 border-b px-4 py-2 text-sm ${notice.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}
          >
            <span className="flex-1">{notice.text}</span>
            <button type="button" className="underline" onClick={() => setNotice(null)}>
              {L.investigators.close}
            </button>
          </div>
        )}

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

      {slipOf?.latestDecision && (
        <RequestSlipDialog
          assignmentId={slipOf.id}
          decision={slipOf.latestDecision}
          canIssue={!!slipOf.can?.issueSlip}
          onClose={() => setSlipOf(null)}
          // The row then carries the slip's number: whoever reads it may save the slip.
          onChanged={() => void refresh()}
        />
      )}
      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title={L.form.confirm.title}
        message={deleting ? L.list.deleteConfirm(deleting.code ?? L.list.noCode) : ''}
        confirmLabel={L.form.actions.delete}
        cancelLabel={L.form.confirm.cancel}
        variant="danger"
      />
    </div>
  );
}
