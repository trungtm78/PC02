/**
 * IncidentListPageShell — PR2/T4 ListPageShell consumer cho Incidents.
 *
 * Mirror canonical CaseListPageShell pattern:
 * - useListPageUrlState('incidents') cho status + page + search + phase
 * - GET /api/v1/incidents/stats fetch + merge với INCIDENT_STATUS_CHIPS
 * - Toolbar search 300ms debounce
 * - Table state machine + overdue highlight
 * - Pagination 20 rows/page
 * - Phase tabs render giữa Header + StatusChips (positional child trong compound API)
 *
 * KHÔNG thay thế production IncidentListPage directly — swap qua feature flag
 * trong PR3 sau khi soak. PR2 ships shell-consumers alongside legacy pages.
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListShortcuts } from '@/hooks/useListShortcuts';
import { FileSearch, Plus, AlertCircle, X, Inbox, Search as SearchIcon, CheckCircle, PauseCircle } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import {
  ListPageShell,
  useListPageUrlState,
  type ColumnDef,
  type TableState,
} from '@/components/shared/ListPageShell';
import { useBulkSelection } from '@/features/_shared/bulk/useBulkSelection';
import { BulkActionBar } from '@/features/_shared/bulk/BulkActionBar';
import { buildIncidentsAdapter } from '@/features/_shared/bulk/adapters/incidents';
import type { BulkAction, BulkResult } from '@/features/_shared/bulk/types';
import {
  INCIDENT_STATUS_CHIPS,
  INCIDENT_STATUS_LABEL,
  INCIDENT_STATUS_BADGE,
} from '@/shared/enums/status-labels';
import { IncidentStatus } from '@/shared/enums/generated';
import { BTN_PRIMARY, A11Y_FOCUS_RING, OVERDUE_ROW_HIGHLIGHT } from '@/constants/styles';
import { StatsCardsStrip, type StatCard } from '@/components/shared/StatsCardsStrip';
import { getIncidentStatusIcon } from '@/shared/enums/status-icons';
import { formatVNDate } from '@/lib/dates';
// v0.64 PR2 — registry-driven row actions + advanced filters
import { RowActions } from '@/features/_shared/row-actions/RowActions';
import { Filters } from '@/features/_shared/list-filters/Filters';
import { useListFilters } from '@/features/_shared/list-filters/useListFilters';
import { useAssignModal } from '@/features/_shared/modals/AssignModalProvider';
import { useDeleteResourceModal } from '@/features/_shared/modals/DeleteResourceModalProvider';
import { useStatusTransitionModal } from '@/features/_shared/modals/StatusTransitionModalProvider';
import { useProsecuteModal } from '@/features/_shared/modals/ProsecuteModalProvider';
import { usePermission } from '@/hooks/usePermission';
import type { ActionContext } from '@/features/_shared/row-actions/registry';
import { incidentsRowActions } from '@/features/incidents/row-actions';
import { incidentsListFilters, type IncidentFilterValue } from '@/features/incidents/list-filters';

// Trust boundary — URL `?incidents_status=__proto__` must not land in lookups.
const INCIDENT_STATUS_VALUES = new Set<string>(Object.values(IncidentStatus));
function isValidIncidentStatus(value: string | null): value is IncidentStatus {
  return value != null && INCIDENT_STATUS_VALUES.has(value);
}

// Phase = grouping of statuses per BCA TT28/2020 4-stage workflow.
// Values MUST match backend PHASE_STATUSES keys at
// backend/src/incidents/incidents.constants.ts:4-17 (kebab-case lowercase).
// /codex review found that UPPER_SNAKE_CASE silently no-ops because backend
// looks up keys directly, never throws on miss.
const PHASE_VALUES = ['tiep-nhan', 'xac-minh', 'ket-qua', 'tam-dinh-chi'] as const;
type IncidentPhase = (typeof PHASE_VALUES)[number];
const PHASE_LABEL: Record<IncidentPhase, string> = {
  'tiep-nhan': 'Tiếp nhận',
  'xac-minh': 'Xác minh',
  'ket-qua': 'Kết quả',
  'tam-dinh-chi': 'Tạm đình chỉ',
};
const PHASE_VALUE_SET = new Set<string>(PHASE_VALUES);
function isValidPhase(value: string | null): value is IncidentPhase {
  return value != null && PHASE_VALUE_SET.has(value);
}

function getVietnameseErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status;
    if (status === 401) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';
    if (status === 403) return 'Bạn không có quyền xem dữ liệu này';
    if (status && status >= 500) return 'Lỗi máy chủ, vui lòng thử lại sau';
    const serverMsg = (e.response?.data as { message?: string } | undefined)?.message;
    if (serverMsg) return serverMsg;
    if (e.code === 'ECONNABORTED') return 'Quá thời gian chờ, vui lòng thử lại';
    return 'Không tải được danh sách vụ việc';
  }
  return 'Lỗi không xác định';
}

interface IncidentRow {
  id: string;
  code: string;
  name: string;
  status: IncidentStatus;
  deadline?: string | null;
  investigator?: { firstName?: string; lastName?: string; username: string } | null;
  donViGiaiQuyet?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface IncidentsStatsResponse {
  total: number;
  byStatus: Record<IncidentStatus, number>;
}

const PAGE_SIZE = 20;

function buildIncidentsCards(stats: IncidentsStatsResponse | null): StatCard[] {
  const by = stats?.byStatus;
  const tiepNhan = by ? (by[IncidentStatus.TIEP_NHAN] ?? 0) : null;
  const xacMinh = by
    ? ([IncidentStatus.DANG_XAC_MINH, IncidentStatus.DA_PHAN_CONG, IncidentStatus.QUA_HAN] as IncidentStatus[]).reduce((s, k) => s + (by[k] ?? 0), 0)
    : null;
  const ketQua = by
    ? ([IncidentStatus.DA_CHUYEN_VU_AN, IncidentStatus.KHONG_KHOI_TO, IncidentStatus.CHUYEN_XPHC, IncidentStatus.PHAN_LOAI_DAN_SU, IncidentStatus.DA_CHUYEN_DON_VI, IncidentStatus.DA_NHAP_VU_KHAC, IncidentStatus.DA_GIAI_QUYET] as IncidentStatus[]).reduce((s, k) => s + (by[k] ?? 0), 0)
    : null;
  const tamDinhChi = by
    ? ([IncidentStatus.TAM_DINH_CHI, IncidentStatus.PHUC_HOI_NGUON_TIN, IncidentStatus.TDC_HET_THOI_HIEU, IncidentStatus.TDC_HTH_KHONG_KT] as IncidentStatus[]).reduce((s, k) => s + (by[k] ?? 0), 0)
    : null;
  return [
    { label: 'Tổng vụ việc', value: stats?.total ?? null, icon: FileSearch, iconBgClass: 'bg-[#003973]/10', iconColorClass: 'text-[#003973]', valueColorClass: 'text-[#003973]' },
    { label: 'Tiếp nhận', value: tiepNhan, icon: Inbox, iconBgClass: 'bg-blue-100', iconColorClass: 'text-blue-600', valueColorClass: 'text-blue-600' },
    { label: 'Xác minh', value: xacMinh, icon: SearchIcon, iconBgClass: 'bg-amber-100', iconColorClass: 'text-amber-600', valueColorClass: 'text-amber-600' },
    { label: 'Kết quả', value: ketQua, icon: CheckCircle, iconBgClass: 'bg-green-100', iconColorClass: 'text-green-600', valueColorClass: 'text-green-600' },
    { label: 'Tạm đình chỉ', value: tamDinhChi, icon: PauseCircle, iconBgClass: 'bg-slate-100', iconColorClass: 'text-slate-600', valueColorClass: 'text-slate-600' },
  ];
}

function isOverdue(deadline?: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date(new Date().setHours(0, 0, 0, 0));
}

export function IncidentListPageShell() {
  const navigate = useNavigate();
  const url = useListPageUrlState('incidents');

  const rawStatus = url.getParam('status');
  const statusFilter = isValidIncidentStatus(rawStatus) ? rawStatus : null;
  const rawPhase = url.getParam('phase');
  const phaseFilter = isValidPhase(rawPhase) ? rawPhase : null;
  const page = Math.max(1, url.getNumberParam('page', 1));
  const searchQuery = url.getParam('q') ?? '';

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<IncidentsStatsResponse | null>(null);
  const [tableState, setTableState] = useState<TableState>('loading');
  const [refetchCounter, setRefetchCounter] = useState(0);
  useListShortcuts({ onNew: () => navigate('/vu-viec/new'), onRefresh: () => setRefetchCounter((n) => n + 1) });
  const [error, setError] = useState<string | undefined>();

  const abortRef = useRef<AbortController | null>(null);

  // v0.64 PR2 — Action context (perms + modal openers).
  // v0.67 PR1 PR2-bis — wire StatusTransition + Prosecute modals.
  const { canDispatch, canEdit, canDelete } = usePermission();
  const assignModal = useAssignModal();
  const deleteModal = useDeleteResourceModal();
  const statusTransitionModal = useStatusTransitionModal();
  const prosecuteModal = useProsecuteModal();
  const actionCtx: ActionContext = useMemo(
    () => ({
      navigate,
      perms: {
        canDispatch,
        canEdit: canEdit('incidents'),
        canDelete: canDelete('incidents'),
      },
      assignModal,
      deleteModal: {
        open: (args) =>
          deleteModal.open({
            ...args,
            onSuccess: () => {
              args.onSuccess?.();
              setRefetchCounter((n) => n + 1);
            },
          }),
      },
      statusTransition: {
        open: (args) =>
          statusTransitionModal.open({
            ...args,
            onSuccess: () => {
              args.onSuccess?.();
              setRefetchCounter((n) => n + 1);
            },
          }),
      },
      prosecute: {
        open: (args) =>
          prosecuteModal.open({
            ...args,
            onSuccess: (caseId) => {
              args.onSuccess?.(caseId);
              // Navigate sang Vụ án mới sau khi atomic transaction tạo Case.
              navigate(`/cases/${caseId}`);
            },
          }),
      },
    }),
    [
      navigate,
      canDispatch,
      canEdit,
      canDelete,
      assignModal,
      deleteModal,
      statusTransitionModal,
      prosecuteModal,
    ],
  );

  // v0.64 PR2 — Advanced filter state + URL sync.
  const listFilters = useListFilters<IncidentFilterValue>({
    prefix: 'incidents',
    registry: incidentsListFilters,
  });
  const appliedFilters = listFilters.applied;

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setTableState('loading');
    setError(undefined);

    const params = {
      ...(statusFilter && { status: statusFilter }),
      ...(phaseFilter && { phase: phaseFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(appliedFilters.keyword && { keyword: appliedFilters.keyword }),
      ...(appliedFilters.loaiDonVu && { loaiDonVu: appliedFilters.loaiDonVu }),
      ...(appliedFilters.reporter && { reporter: appliedFilters.reporter }),
      ...(appliedFilters.unit && { unit: appliedFilters.unit }),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };

    api
      .get<{ data: IncidentRow[]; total: number }>('/incidents', { params, signal: ctrl.signal })
      .then((listRes) => {
        if (ctrl.signal.aborted) return;
        setRows(listRes.data.data);
        setTotalCount(listRes.data.total);
        if (listRes.data.total === 0) {
          setTableState(debouncedSearch || statusFilter || phaseFilter ? 'empty-filtered' : 'empty');
        } else {
          setTableState('ready');
        }
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        setError(getVietnameseErrorMessage(e));
        setTableState('error');
      });

    return () => ctrl.abort();
    // refetchCounter forces refetch after bulk action success (declared below for hoisting OK at runtime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, phaseFilter, page, debouncedSearch, refetchCounter, appliedFilters]);

  // Stats fetch: search + phase pass-through, status purposely stripped.
  useEffect(() => {
    const ctrl = new AbortController();
    const statsParams = {
      ...(phaseFilter && { phase: phaseFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
    };
    api
      .get<IncidentsStatsResponse>('/incidents/stats', { params: statsParams, signal: ctrl.signal })
      .then((statsRes) => {
        if (ctrl.signal.aborted) return;
        setStats(statsRes.data);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        // Non-blocking: chips chỉ ẩn counts khi stats fail.
      });

    return () => ctrl.abort();
  }, [debouncedSearch, phaseFilter]);

  const chipOptions = useMemo(
    () =>
      INCIDENT_STATUS_CHIPS.map((c) => ({
        value: c.value,
        shortLabel: c.shortLabel,
        label: c.label,
        count: stats?.byStatus[c.value],
      })),
    [stats],
  );

  // /investigate v0.61 fix Bug 2 — bulk integration mirror Cases pattern.
  const selection = useBulkSelection<IncidentRow>({
    rowKey: 'id',
    pageRows: rows,
    totalCountMatchingFilter: totalCount,
  });
  const adapter = useMemo(() => buildIncidentsAdapter({ enableDelete: true }), []);
  const selectionClearRef = useRef(selection.clear);
  selectionClearRef.current = selection.clear;
  useEffect(() => {
    selectionClearRef.current();
  }, [statusFilter, phaseFilter, page, debouncedSearch]);
  const [transientBanner, setTransientBanner] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const handleBulkSuccess = useCallback(
    (result: BulkResult | void, action: BulkAction<IncidentRow>) => {
      if (action.key === 'export') {
        setTransientBanner({ kind: 'success', text: 'Đã xuất Excel' });
        return;
      }
      if (result && typeof result === 'object') {
        const { succeeded, skipped, failed } = result;
        const parts: string[] = [];
        if (succeeded?.length) parts.push(`Đã xử lý ${succeeded.length} vụ việc`);
        if (skipped?.length) parts.push(`Bỏ qua ${skipped.length}`);
        if (failed?.length) parts.push(`Lỗi ${failed.length}`);
        setTransientBanner({
          kind: failed?.length ? 'error' : 'success',
          text: parts.join(' · ') || 'Hoàn tất',
        });
        setRefetchCounter((c) => c + 1);
      }
    },
    [],
  );
  const handleBulkError = useCallback(
    (err: unknown, action: BulkAction<IncidentRow>) => {
      setTransientBanner({
        kind: 'error',
        text: `Thao tác "${action.label}" thất bại: ${getVietnameseErrorMessage(err)}`,
      });
    },
    [],
  );
  useEffect(() => {
    if (!transientBanner) return;
    const t = setTimeout(() => setTransientBanner(null), 5000);
    return () => clearTimeout(t);
  }, [transientBanner]);

  const columns: ColumnDef<IncidentRow>[] = useMemo(
    () => [
      {
        key: 'actions',
        header: 'Thao tác',
        width: '8rem',
        render: (r) => (
          <RowActions
            registry={incidentsRowActions}
            row={{
              id: r.id,
              status: r.status as unknown as string,
              name: r.name,
              updatedAt: r.updatedAt,
            }}
            ctx={actionCtx}
          />
        ),
      },
      {
        key: 'code',
        header: 'Mã vụ việc',
        render: (r) => <span className="font-mono text-xs text-slate-700">{r.code}</span>,
      },
      {
        key: 'name',
        header: 'Tên vụ việc',
        render: (r) => <span className="font-medium text-slate-800">{r.name}</span>,
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${INCIDENT_STATUS_BADGE[r.status]}`}>
            {getIncidentStatusIcon(r.status)}
            {INCIDENT_STATUS_LABEL[r.status]}
          </span>
        ),
      },
      {
        key: 'investigator',
        header: 'Điều tra viên',
        render: (r) => {
          if (!r.investigator) return '—';
          const name = [r.investigator.firstName, r.investigator.lastName]
            .filter(Boolean)
            .join(' ');
          return name || r.investigator.username;
        },
      },
      {
        key: 'donViGiaiQuyet',
        header: 'Đơn vị thụ lý',
        render: (r) => r.donViGiaiQuyet ?? '—',
      },
      {
        key: 'deadline',
        header: 'Hạn xử lý',
        render: (r) => {
          if (!r.deadline) return '—';
          const overdue = isOverdue(r.deadline);
          return (
            <span className={overdue ? 'text-red-700 font-semibold' : 'text-slate-700'}>
              {formatVNDate(r.deadline)}
            </span>
          );
        },
      },
      {
        key: 'createdAt',
        header: 'Ngày tạo',
        render: (r) => formatVNDate(r.createdAt),
      },
    ],
    [actionCtx],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleStatusChange = useCallback(
    (value: string | null) => {
      url.setParams({ status: value, page: '1' });
    },
    [url],
  );

  const handlePhaseChange = useCallback(
    (value: IncidentPhase | null) => {
      url.setParams({ phase: value, page: '1' });
    },
    [url],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      url.setParams({ q: value, page: '1' });
    },
    [url],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      url.setParam('page', String(newPage));
    },
    [url],
  );

  const handleResetFilters = useCallback(() => {
    url.clearAll();
    listFilters.reset();
  }, [url, listFilters]);

  const appliedFilterCount = Object.values(appliedFilters).filter((v) => v && v !== '').length;
  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (phaseFilter ? 1 : 0) +
    (searchQuery ? 1 : 0) +
    appliedFilterCount;

  return (
    <ListPageShell>
      <ListPageShell.Header
        icon={FileSearch}
        title="Danh sách vụ việc"
        subtitle="Nguồn tin tội phạm (Đ.144 BLTTHS) — tiếp nhận, xác minh, kết quả"
        actions={
          <button
            type="button"
            onClick={() => navigate('/incidents/new')}
            className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} flex items-center gap-2`}
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mới</span>
          </button>
        }
      />
      <StatsCardsStrip cards={buildIncidentsCards(stats)} loading={stats == null} />
      {/* Phase tabs render giữa Header + StatusChips theo plan PR2 compound API */}
      <div
        role="tablist"
        aria-label="Giai đoạn xử lý"
        className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={phaseFilter === null}
          onClick={() => handlePhaseChange(null)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${A11Y_FOCUS_RING} ${
            phaseFilter === null
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          Tất cả giai đoạn
        </button>
        {PHASE_VALUES.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={phaseFilter === p}
            onClick={() => handlePhaseChange(p)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${A11Y_FOCUS_RING} ${
              phaseFilter === p
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {PHASE_LABEL[p]}
          </button>
        ))}
      </div>
      <ListPageShell.StatusChips
        options={chipOptions}
        activeValue={statusFilter}
        onChange={handleStatusChange}
        totalCount={stats?.total}
        countsLoading={stats == null}
      />
      <ListPageShell.Toolbar
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Tìm kiếm theo mã, tên, đối tượng..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        cardStyle
      >
        <Filters<IncidentFilterValue>
          registry={incidentsListFilters}
          value={listFilters.draft}
          onChange={listFilters.setField}
          onApply={listFilters.apply}
          onReset={listFilters.reset}
          hasUnappliedChanges={listFilters.hasUnappliedChanges}
        />
      </ListPageShell.Toolbar>
      {transientBanner && (
        <div
          data-testid="incidents-bulk-banner"
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-200 text-sm ${
            transientBanner.kind === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{transientBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setTransientBanner(null)}
            className={`p-1 rounded hover:bg-white/40 ${A11Y_FOCUS_RING}`}
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <ListPageShell.Table<IncidentRow>
        state={tableState}
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        title="Danh sách vụ việc"
        sectionTitle="Danh sách vụ việc"
        totalCount={totalCount}
        error={error}
        emptyState={{
          title: 'Chưa có vụ việc nào',
          description: 'Tạo vụ việc đầu tiên để bắt đầu xác minh nguồn tin.',
          actionLabel: 'Tạo vụ việc mới',
          onAction: () => navigate('/incidents/new'),
        }}
        emptyFilteredState={{ onClearFilters: handleResetFilters }}
        onRowClick={(r) => navigate(`/incidents/${r.id}`)}
        getRowClassName={(r) => (isOverdue(r.deadline) ? OVERDUE_ROW_HIGHLIGHT : '')}
        bulkSelection={selection}
        bulkRowsLabel="vụ việc"
        bulkRowLabel={(r) => `vụ việc ${r.code}`}
      />
      <ListPageShell.Pagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={handlePageChange}
      />
      <BulkActionBar
        selection={selection}
        adapter={adapter}
        pageRows={rows}
        onSuccess={handleBulkSuccess}
        onError={handleBulkError}
      />
    </ListPageShell>
  );
}

export default IncidentListPageShell;
