/**
 * /ho-so-phan-cong — the ward assignment requests the person may read (the server applies the reach).
 *
 * Built as the petition list is, from the same parts:
 *  - "Tạo mới" with its shortcut (Alt+N; Alt+R reads again, Ctrl+K and "/" go to the search box, Ctrl+E exports);
 *  - six status cards that filter (one answer of the server, each number the number of rows under that card);
 *  - the tag search over every column, the filter panel (first submission day, unit, kinds, deadline alert), with
 *    the active count and "Xóa lọc"; Excel of exactly what is filtered, in the order and the columns shown;
 *  - columns sortable, resizable, reorderable, hidden or shown, a row density, all kept per account;
 *  - an actions column first, pinned (open, edit, print the request slip, delete a draft), the row click of the
 *    system setting, and several rows chosen at once for the deletion of drafts.
 * What a row offers is the server's answer for that row (`can`), the same rules as the form.
 *
 * The status has ONE control, the cards: status chips beside them would be a second writer of the same state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Archive, CheckCircle, ClipboardList, Eye, FileEdit, Inbox, Pencil, Plus, Printer, Trash2, Undo2, Layers, X } from 'lucide-react';
import {
  ListPageShell,
  ColumnPicker,
  ChonMatDo,
  DanhSachThe,
  DateCell,
  OTimKiemThe,
  SummaryCell,
  truongGoiY,
  useBoCucCot,
  useListPageUrlState,
  useListSort,
  useMatDoDong,
  useTheTimKiem,
  type ColumnDef,
} from '@/components/shared/ListPageShell';
import { BE_RONG_COT_THAO_TAC } from '@/components/shared/ListPageShell/cotThaoTac';
import { ConfirmModal } from '@/components/shared/Modal';
import { ShortcutHint } from '@/components/ShortcutCheatSheet';
import { StatsCardsStrip, type StatCard } from '@/components/shared/StatsCardsStrip';
import { A11Y_FOCUS_RING, BTN_PRIMARY, BTN_SECONDARY, OVERDUE_ROW_HIGHLIGHT } from '@/constants/styles';
import { BulkActionBar } from '@/features/_shared/bulk/BulkActionBar';
import type { BulkAction, BulkAdapter, BulkResult } from '@/features/_shared/bulk/types';
import { useBulkSelection } from '@/features/_shared/bulk/useBulkSelection';
import { DateRangePresets } from '@/features/_shared/list-filters/DateRangePresets';
import { Filters } from '@/features/_shared/list-filters/Filters';
import { NutXuatTheoBoLoc } from '@/features/_shared/list-filters/NutXuatTheoBoLoc';
import { useListFilters } from '@/features/_shared/list-filters/useListFilters';
import { RowActions } from '@/features/_shared/row-actions/RowActions';
import { createRowActionRegistry, type ActionContext } from '@/features/_shared/row-actions/registry';
import { wardAssignmentsApi, WARD_QUERY_KEYS } from '@/features/ward-assignments/api';
import { AlertBadge } from '@/features/ward-assignments/components/AlertBadge';
import { RequestSlipDialog } from '@/features/ward-assignments/components/RequestSlipDialog';
import { WardStatusBadge } from '@/features/ward-assignments/components/WardStatusBadge';
import { explainWardError } from '@/features/ward-assignments/errors';
import { displayStatus } from '@/features/ward-assignments/formModel';
import { wardListFilters, type WardFilterValue } from '@/features/ward-assignments/list-filters';
import { WARD_PATHS } from '@/features/ward-assignments/menu';
import { WARD_STATUSES, type WardAssignmentRow, type WardListQuery, type WardStatus } from '@/features/ward-assignments/types';
import { useBamDong } from '@/hooks/useBamDong';
import { useListShortcuts } from '@/hooks/useListShortcuts';
import { usePermission } from '@/hooks/usePermission';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from '@/shared/enums/permissions';
import { TIM_KIEM_HO_SO_PHAN_CONG } from '@/shared/tim-kiem/generated';
import { KHOA_TAT_CA } from '@/shared/tim-kiem/the';

const PAGE_SIZE = 20;
/** The prefix of this screen's URL keys (`hspc_page`, `hspc_the`, `hspc_tk`…): never another screen's. */
const PREFIX = 'hspc';
/** The key the old search box wrote (`hspc_q`): it opens as the tag "every column". */
const OLD_PARAMETERS = { q: KHOA_TAT_CA } as const;
const SEARCH_DEBOUNCE_MS = 300;

type CardKey = 'all' | WardStatus | 'archived';
const CARD_KEYS: readonly CardKey[] = ['all', ...WARD_STATUSES, 'archived'];

function queryOfCard(card: CardKey): WardListQuery {
  return card === 'archived' ? { archived: true } : card === 'all' ? {} : { status: card };
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

/** What "Xóa lọc" removes besides this screen's own keys: what a number of the statistics page opened the list with. */
const drillAndStatusKeys: readonly string[] = [...DRILL_KEYS, 'status'];

/** The filter panel as the server reads it. */
function queryOfFilters(f: WardFilterValue): Partial<WardListQuery> {
  return {
    ...(f.fromDate ? { from: f.fromDate } : {}),
    ...(f.toDate ? { to: f.toDate } : {}),
    ...(f.teamId ? { teamId: f.teamId } : {}),
    ...(f.caseType ? { caseType: f.caseType } : {}),
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.alert ? { alert: f.alert } : {}),
  };
}

/** The "Hạn báo kết quả" cell: the due day, coloured by the deadline alert the server judged (`row.alert`). */
function ResultDueCell({ row }: { row: WardAssignmentRow }) {
  return (
    <span data-testid={`ward-due-${row.id}`} className="inline-flex flex-wrap items-center gap-2 text-slate-700">
      {row.resultDueOn ? <DateCell value={row.resultDueOn} quaHan={row.alert?.level === 'OVERDUE'} /> : null}
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

/** The values of the tags that are chosen, not typed, worded as the columns word them. */
const TAG_VALUES = {
  loaiHoSo: [
    { value: 'INCIDENT', label: L.caseType.INCIDENT },
    { value: 'CASE', label: L.caseType.CASE },
  ],
  phanCong: [
    { value: 'NEW', label: L.kind.NEW },
    { value: 'REASSIGN', label: L.kind.REASSIGN },
  ],
} as const;

/** The modals of the record lists (assign, delete with a reason, print documents) are not this screen's: its own are below. */
const NO_MODAL = { open: () => undefined };

export default function WardAssignmentListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const url = useListPageUrlState('hspc');
  const { permissions } = usePermission();
  const holds = (permission: string) => permissions === null || permissions.includes(permission);
  const canCreate = holds('write:WardAssignment');
  // The row says how far the person's reach goes; the route also asks for the permission of the action.
  const mayEdit = holds('edit:WardAssignment');
  const mayDelete = holds('delete:WardAssignment');
  const [slipOf, setSlipOf] = useState<WardAssignmentRow | null>(null);
  const [deleting, setDeleting] = useState<WardAssignmentRow | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // A number of the statistics page opens the list with its status: that is the card shown, unless one is chosen.
  const cardParam = url.getParam('the') ?? params.get('status') ?? '';
  const card = (CARD_KEYS as readonly string[]).includes(cardParam) ? (cardParam as CardKey) : 'all';
  const drill = drillOf(params);
  const drillKey = JSON.stringify(drill);
  const drilled = drillKey !== '{}';
  const page = Math.max(1, url.getNumberParam('page', 1));

  // The tag search. Its switch off (an emergency switch, on unless an administrator turns it off): the plain box,
  // which the server reads as "every column" all the same.
  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  const timKiem = useTheTimKiem({ prefix: PREFIX, khai: TIM_KIEM_HO_SO_PHAN_CONG, giaTriChon: TAG_VALUES, thamSoCu: OLD_PARAMETERS, bat: theBat });
  // By VALUE: `tkGui` is a new array on every change of the address, a change of page included.
  const tkKey = JSON.stringify(timKiem.tkGui);
  const plainQ = theBat ? '' : (url.getParam('q') ?? '').trim();
  const [debouncedQ, setDebouncedQ] = useState(plainQ);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(plainQ), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [plainQ]);

  const sort = useListSort(PREFIX);
  const listFilters = useListFilters<WardFilterValue>({ prefix: 'hspc', registry: wardListFilters });
  const appliedFilters = listFilters.applied;

  /** Everything that narrows the list except the card and the page: the list, its cards and its export share it. */
  const filterQuery = useMemo<Partial<WardListQuery>>(() => {
    const tags = JSON.parse(tkKey) as string[];
    return {
      ...(JSON.parse(drillKey) as Partial<WardListQuery>),
      ...queryOfFilters(appliedFilters),
      ...(theBat ? (tags.length ? { tk: tags } : {}) : debouncedQ ? { q: debouncedQ } : {}),
    };
  }, [drillKey, appliedFilters, theBat, tkKey, debouncedQ]);

  const listQuery: WardListQuery = { ...filterQuery, ...queryOfCard(card), ...sort.params, page, pageSize: PAGE_SIZE };
  const listQ = useQuery({
    queryKey: WARD_QUERY_KEYS.list(listQuery),
    queryFn: () => wardAssignmentsApi.list(listQuery),
    staleTime: 10_000,
    retry: false,
  });
  // One answer for the six cards, under the same filters as the rows: a card's number is the number of rows it shows.
  const statsQ = useQuery({
    queryKey: WARD_QUERY_KEYS.stats(filterQuery),
    queryFn: () => wardAssignmentsApi.listStats(filterQuery),
    staleTime: 10_000,
    retry: false,
  });
  const unitsQ = useQuery({ queryKey: WARD_QUERY_KEYS.filterUnits, queryFn: () => wardAssignmentsApi.filterUnits(), staleTime: 10 * 60_000, retry: false });

  const data = useMemo(() => listQ.data?.data ?? [], [listQ.data]);
  const total = listQ.data?.total ?? 0;

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: WARD_QUERY_KEYS.all }), [qc]);
  useListShortcuts({
    onNew: canCreate ? () => navigate(WARD_PATHS.create) : undefined,
    onRefresh: () => void refresh(),
    onExport: () => document.querySelector<HTMLButtonElement>('[data-testid="btn-xuat-dang-xem"]')?.click(),
  });

  const selectCard = (value: string | null) => {
    // A card chosen replaces the status a number of the statistics page opened with. A step of the history: Back
    // returns to the card before.
    if (params.has('status')) {
      const p = new URLSearchParams(params);
      p.delete('status');
      p.delete(`${PREFIX}_page`);
      if (value) p.set(`${PREFIX}_the`, value);
      else p.delete(`${PREFIX}_the`);
      setParams(p);
      return;
    }
    url.setParams({ the: value, page: null }, { history: 'push' });
  };

  const stats = statsQ.data;
  const cards: StatCard[] = CARD_KEYS.map((key) => ({
    label: L.list.cards[key],
    value: !stats ? null : key === 'all' ? stats.all : key === 'archived' ? stats.archived : (stats.byStatus[key] ?? 0),
    filterValue: key === 'all' ? null : key,
    testId: `ward-card-${key}`,
    ...CARD_STYLE[key],
  }));

  const T = L.list.actions;
  // Built here, not at module level: the print and delete actions open this screen's own dialogs.
  const rowActions = useMemo(
    () =>
      createRowActionRegistry<WardAssignmentRow>().registerMany([
        { key: 'view', label: T.view, icon: Eye, position: 'inline', execute: (row, ctx) => ctx.navigate(WARD_PATHS.view(row.id)), testid: 'btn-view' },
        { key: 'edit', label: T.edit, icon: Pencil, position: 'inline', visible: (row) => mayEdit && !!row.can?.edit, execute: (row, ctx) => ctx.navigate(WARD_PATHS.edit(row.id)), testid: 'btn-edit' },
        // (As below: the key stays on the line of the brace, so that the gates do not read it as a column.)
        { key: 'print',
          label: T.print,
          icon: Printer,
          position: 'inline',
          // A decision of PC02 to print the slip of: PC02 issues it, whoever reads the request saves an issued one.
          visible: (row) => !!row.latestDecision && (!!row.can?.issueSlip || !!row.latestDecision.slipNumber),
          execute: (row) => setSlipOf(row),
          testid: 'btn-print',
        },
        { key: 'delete', label: T.delete, icon: Trash2, position: 'inline', danger: true, visible: (row) => mayDelete && !!row.can?.delete, execute: (row) => setDeleting(row), testid: 'btn-delete' },
      ]),
    [T, mayEdit, mayDelete],
  );
  const actionCtx: ActionContext = { navigate, perms: {}, assignModal: NO_MODAL, deleteModal: NO_MODAL, printModal: NO_MODAL };

  const bamDong = useBamDong<WardAssignmentRow>('HO_SO_PHAN_CONG', {
    hrefXem: (r) => WARD_PATHS.view(r.id),
    hrefSua: (r) => WARD_PATHS.edit(r.id),
    coQuyenSua: (r) => mayEdit && !!r.can?.edit,
  });

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
      timKiem: 'ma',
      sortKey: 'code',
      cellClassName: 'px-3 py-3 font-medium',
      render: (r) => (
        <Link
          to={WARD_PATHS.view(r.id)}
          aria-label={L.list.open(r.code ?? L.list.noCode)}
          className={`text-blue-700 hover:underline ${A11Y_FOCUS_RING}`}
          // The row has its own click (a system setting): the link is the link, not also a row click.
          onClick={(e) => e.stopPropagation()}
        >
          {r.code ?? <span className="italic text-slate-500">{L.list.noCode}</span>}
        </Link>
      ),
    },
    {
      key: 'submittedAt',
      header: C.submittedAt,
      width: '8rem',
      optional: 'show',
      timKiem: 'ngayTrinh',
      sortKey: 'submittedAt',
      cellClassName: 'px-3 py-3',
      render: (r) => (r.submittedAt ? <DateCell value={r.submittedAt} /> : ''),
    },
    {
      key: 'unit',
      header: C.unit,
      width: '12rem',
      optional: 'show',
      cellClassName: 'px-3 py-3',
      render: (r) => r.assignedTeam?.name ?? '',
    },
    {
      key: 'caseType',
      header: C.caseType,
      width: '7rem',
      optional: 'show',
      timKiem: 'loaiHoSo',
      sortKey: 'caseType',
      cellClassName: 'px-3 py-3',
      render: (r) => L.caseType[r.caseType],
    },
    {
      key: 'kind',
      header: C.kind,
      width: '6rem',
      optional: 'show',
      timKiem: 'phanCong',
      sortKey: 'kind',
      cellClassName: 'px-3 py-3',
      render: (r) => L.kind[r.kind],
    },
    {
      key: 'crime',
      header: C.crime,
      width: '12rem',
      optional: 'show',
      timKiem: ['toiDanh', 'toiDanhKhac'],
      cellClassName: 'px-3 py-3',
      render: (r) => r.crime?.name ?? r.crimeOther ?? '',
    },
    {
      key: 'summary',
      header: C.summary,
      width: '18rem',
      optional: 'show',
      timKiem: 'trichYeu',
      sortKey: 'summary',
      cellClassName: 'px-3 py-3',
      render: (r) => <SummaryCell value={r.summary} />,
    },
    {
      key: 'status',
      header: C.status,
      width: '10rem',
      optional: 'show',
      sortKey: 'status',
      cellClassName: 'px-3 py-3',
      render: (r) => <WardStatusBadge status={displayStatus(r)} />,
    },
    {
      key: 'submissionCount',
      header: C.submissionCount,
      width: '6rem',
      optional: 'show',
      sortKey: 'submissionCount',
      cellClassName: 'px-3 py-3 text-right tabular-nums',
      render: (r) => r.submissionCount,
    },
    {
      key: 'resultDueOn',
      header: C.resultDueOn,
      width: '10rem',
      optional: 'show',
      timKiem: 'hanBaoKetQua',
      sortKey: 'resultDueOn',
      cellClassName: 'px-3 py-3',
      render: (r) => <ResultDueCell row={r} />,
    },
    {
      key: 'place',
      header: C.place,
      width: '12rem',
      optional: 'hide',
      timKiem: 'noiXayRa',
      cellClassName: 'px-3 py-3',
      render: (r) => <SummaryCell value={r.place ?? ''} />,
    },
    {
      key: 'entryOfficerName',
      header: C.entryOfficerName,
      width: '10rem',
      optional: 'hide',
      timKiem: 'canBoNhap',
      cellClassName: 'px-3 py-3',
      render: (r) => r.entryOfficerName ?? '',
    },
  ];
  const { coGhiDeBeRong, visibleColumns, toggleableColumns, isVisible, batTat, datBeRong, xoaBeRong, doiCho, datLai } = useBoCucCot('ward-assignments', columns);
  const [matDo, datMatDo] = useMatDoDong('ward-assignments');
  // The suggestions of the tag box are the columns shown, in their order: a hidden column leaves the suggestions.
  const truongTimKiem = useMemo(() => truongGoiY(visibleColumns, TIM_KIEM_HO_SO_PHAN_CONG), [visibleColumns]);

  // ── several rows at once: drafts never submitted are deleted, each with the stamp the list read ──
  const selection = useBulkSelection<WardAssignmentRow>({ rowKey: 'id', pageRows: data, totalCountMatchingFilter: total });
  // The selection belongs to the rows it was made on: cleared at once when the address moves to others.
  const clearSelection = useRef(selection.clear);
  clearSelection.current = selection.clear;
  const filterKey = JSON.stringify(filterQuery);
  useEffect(() => {
    clearSelection.current();
  }, [page, card, filterKey, sort.sortBy, sort.sortOrder]);
  const rowsById = useRef(new Map<string, WardAssignmentRow>());
  rowsById.current = new Map(data.map((r) => [r.id, r]));
  const adapter = useMemo<BulkAdapter<WardAssignmentRow>>(
    () => ({
      resource: PERMISSION_RESOURCE.WARD_ASSIGNMENTS,
      resourceLabel: L.list.bulk.rows,
      actions: [
        // (The key stays on the line of the brace: a `key:` at the start of a line is how the gates read a COLUMN.)
        { key: 'delete',
          label: L.list.bulk.delete,
          variant: 'danger',
          permission: { resource: PERMISSION_RESOURCE.WARD_ASSIGNMENTS, action: PERMISSION_ACTION.DELETE },
          requiresPreview: false,
          allowsAllMatchingFilter: false,
          rowEligibility: (row) => (row.can?.delete ? null : L.list.bulk.onlyDrafts),
          // One request per draft, each its own transaction and audit line on the server, each with its own stamp.
          execute: async ({ ids }) => {
            const result: BulkResult = { succeeded: [], skipped: [], failed: [] };
            for (const id of ids) {
              const row = rowsById.current.get(id);
              if (!row?.can?.delete) {
                result.skipped.push({ id, reason: 'INELIGIBLE', message: L.list.bulk.onlyDrafts });
                continue;
              }
              try {
                await wardAssignmentsApi.remove(id, row.updatedAt);
                result.succeeded.push({ id });
              } catch (err) {
                const e = explainWardError(err);
                if (e.conflict) result.skipped.push({ id, reason: 'CONCURRENT_MODIFICATION', message: e.message });
                else result.failed.push({ id, error: e.message });
              }
            }
            return result;
          },
        },
      ],
    }),
    [],
  );
  const onBulkDone = useCallback(
    (result: BulkResult | void, action: BulkAction<WardAssignmentRow>) => {
      if (action.key === 'delete' && result) {
        const parts = [
          result.succeeded.length ? L.list.bulk.deleted(result.succeeded.length) : '',
          result.skipped.length ? L.list.bulk.skipped(result.skipped.length) : '',
          result.failed.length ? L.list.bulk.failed(result.failed.length) : '',
        ].filter(Boolean);
        setNotice({ kind: result.failed.length ? 'error' : 'ok', text: parts.join(' · ') || L.list.bulk.done });
      }
      void refresh();
    },
    [refresh],
  );
  const onBulkError = useCallback((err: unknown) => setNotice({ kind: 'error', text: explainWardError(err).message }), []);

  const activeFilterCount =
    (card === 'all' ? 0 : 1) + (theBat ? timKiem.theHopLe.length : plainQ ? 1 : 0) + Object.values(appliedFilters).filter((v) => v !== undefined && v !== '').length + (drilled ? 1 : 0);
  const filtered = activeFilterCount > 0 || timKiem.the.length > 0;

  // "Xóa lọc" takes everything back: the panel, then the address of this screen (cards, tags, page, order) with the
  // keys a number of the statistics page opened. The address is written LAST: an earlier write would be overwritten.
  const handleResetFilters = useCallback(() => {
    listFilters.reset();
    url.clearAll(drillAndStatusKeys);
  }, [listFilters, url]);

  const exportParams = { ...filterQuery, ...queryOfCard(card), ...sort.params };
  const exportColumns = visibleColumns.map((c) => c.key).filter((k) => k !== 'actions');

  return (
    <div data-testid="ward-assignment-list-page">
      <ListPageShell>
        <ListPageShell.Header
          icon={ClipboardList}
          title={L.title}
          subtitle={L.list.hint}
          actions={
            canCreate ? (
              <div className="flex items-center gap-2">
                <button type="button" data-testid="ward-create" className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} flex items-center gap-2`} onClick={() => navigate(WARD_PATHS.create)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{L.list.create}</span>
                  <ShortcutHint action="newRecord" className="ml-1" />
                </button>
              </div>
            ) : undefined
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
                p.delete(`${PREFIX}_page`);
                setParams(p, { replace: true });
              }}
            >
              {L.list.drill.clear}
            </button>
          </div>
        )}

        <StatsCardsStrip
          cards={cards}
          loading={statsQ.isLoading}
          gridClassName="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 px-6 py-4"
          activeValue={card === 'all' ? null : card}
          onCardSelect={selectCard}
        />

        <ListPageShell.Toolbar
          searchValue={theBat ? undefined : (url.getParam('q') ?? '')}
          onSearchChange={theBat ? undefined : (value) => url.setParams({ q: value, page: null })}
          searchSlot={
            theBat ? (
              <OTimKiemThe
                the={timKiem.the}
                truong={truongTimKiem}
                khai={TIM_KIEM_HO_SO_PHAN_CONG}
                giaTriChon={TAG_VALUES}
                showDatePicker
                onThem={timKiem.them}
                onBoThe={timKiem.boThe}
                onBoGiaTri={timKiem.boGiaTri}
                placeholder={L.list.searchTags}
                // A tag of a column that is hidden: the column is shown, so that what is searched is seen.
                onChonTruongAn={(key) => {
                  const cot = columns.find((c) => (Array.isArray(c.timKiem) ? c.timKiem.includes(key) : c.timKiem === key));
                  if (cot && !isVisible(cot.key)) batTat(cot.key);
                }}
              />
            ) : undefined
          }
          searchPlaceholder={L.list.searchPlaceholder}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          cardStyle
          columnPicker={
            <div className="flex items-center gap-2">
              <ChonMatDo giaTri={matDo} onDoi={datMatDo} />
              <ColumnPicker columns={toggleableColumns} isVisible={isVisible} onToggle={batTat} onReset={datLai} onDoiCho={doiCho} />
            </div>
          }
        >
          <Filters<WardFilterValue>
            registry={wardListFilters}
            value={listFilters.draft}
            onChange={listFilters.setField}
            onApply={listFilters.apply}
            onReset={listFilters.reset}
            hasUnappliedChanges={listFilters.hasUnappliedChanges}
            dynamicOptions={{ teamId: [{ value: '', label: L.list.filters.all }, ...(unitsQ.data ?? []).map((u) => ({ value: u.id, label: u.name }))] }}
            hanhDongPhu={
              <>
                <span data-testid="ward-matching-count" className="text-sm text-slate-600">
                  {listQ.isLoading ? '' : L.list.matching(total)}
                </span>
                <NutXuatTheoBoLoc
                  duongDan="/ward-assignments/export/danh-sach"
                  thamSo={exportParams}
                  cot={exportColumns}
                  tong={listQ.isLoading ? null : total}
                  hasUnappliedChanges={listFilters.hasUnappliedChanges}
                  onApply={listFilters.apply}
                  tenDuPhong="ho-so-phan-cong.xlsx"
                  nhanRieng={L.list.exportShown}
                  testId="btn-xuat-dang-xem"
                />
                <NutXuatTheoBoLoc
                  duongDan="/ward-assignments/export/danh-sach"
                  thamSo={exportParams}
                  cot={[]}
                  boQuaCot
                  tong={listQ.isLoading ? null : total}
                  hasUnappliedChanges={listFilters.hasUnappliedChanges}
                  onApply={listFilters.apply}
                  tenDuPhong="ho-so-phan-cong-day-du.xlsx"
                  nhanRieng={L.list.exportAll}
                  testId="btn-xuat-day-du"
                  goiY={L.list.exportAllHint}
                />
              </>
            }
          >
            <DateRangePresets
              onPick={(r) => {
                listFilters.setField('fromDate', r.fromDate);
                listFilters.setField('toDate', r.toDate);
              }}
            />
          </Filters>
        </ListPageShell.Toolbar>

        {notice && (
          <div
            data-testid="ward-list-notice"
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={`flex items-center gap-3 border-b px-4 py-2 text-sm ${notice.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}
          >
            <span className="flex-1">{notice.text}</span>
            <button type="button" className={`rounded p-1 hover:bg-white/40 ${A11Y_FOCUS_RING}`} aria-label={L.investigators.close} onClick={() => setNotice(null)}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
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
            xuongDong
            matDo={matDo}
            onKeoGian={datBeRong}
            onVeMacDinhCot={xoaBeRong}
            datTongBeRong={coGhiDeBeRong}
            columns={visibleColumns}
            data={data}
            rowKey={(r) => r.id}
            rowTestId={(r) => `ward-row-${r.id}`}
            title={L.title}
            totalCount={total}
            sortBy={sort.sortBy}
            sortOrder={sort.sortOrder}
            onSort={sort.onSort}
            onRowClick={bamDong.onRowClick}
            onRowDoubleClick={bamDong.onRowDoubleClick}
            rowHref={bamDong.rowHref}
            // A request past its deadline stands out as an overdue petition does.
            getRowClassName={(r) => (r.alert?.level === 'OVERDUE' ? OVERDUE_ROW_HIGHLIGHT : '')}
            bulkSelection={mayDelete ? selection : undefined}
            bulkRowsLabel={L.list.bulk.rows}
            bulkRowLabel={(r) => L.list.bulk.row(r.code ?? L.list.noCode)}
            emptyState={{
              title: L.list.empty,
              description: canCreate ? L.list.emptyHint : undefined,
              actionLabel: canCreate ? L.list.emptyCreate : undefined,
              onAction: canCreate ? () => navigate(WARD_PATHS.create) : undefined,
            }}
            emptyFilteredState={{
              onClearFilters: handleResetFilters,
              chiTiet:
                timKiem.the.length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                    <span>{L.list.notFoundWith}</span>
                    <DanhSachThe the={timKiem.the} khai={TIM_KIEM_HO_SO_PHAN_CONG} giaTriChon={TAG_VALUES} onBoThe={timKiem.boThe} />
                  </div>
                ) : undefined,
            }}
          />
        )}
        <ListPageShell.Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} totalCount={total} onPageChange={(n) => url.setParam('page', n > 1 ? String(n) : null)} />
      </ListPageShell>

      <BulkActionBar selection={selection} adapter={adapter} pageRows={data} onSuccess={onBulkDone} onError={onBulkError} />

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
