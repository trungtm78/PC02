/**
 * CaseListPageShell — canonical reference implementation cho <ListPageShell>.
 *
 * PR1/T16: minimal-but-real demo consumer chứng minh API thực dùng được.
 * KHÔNG thay thế production CaseListPage trực tiếp — swap qua feature flag
 * trong PR2 sau khi soak.
 *
 * Demonstrates:
 * - useListPageUrlState cho status + page + search sync
 * - GET /api/v1/cases/stats fetch + merge với CASE_STATUS_CHIPS
 * - Toolbar search debounce qua URL state
 * - Table state machine (loading/error/empty/empty-filtered/ready)
 * - Pagination 20 rows/page
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListShortcuts } from '@/hooks/useListShortcuts';
import { ShortcutHint } from '@/components/ShortcutCheatSheet';
import { Folder, Plus, Clock, CheckCircle, XCircle, PauseCircle } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import {
  ListPageShell,
  useListPageUrlState,
  type ColumnDef,
  type TableState,
} from '@/components/shared/ListPageShell';
import {
  CASE_STATUS_CHIPS,
  CASE_STATUS_LABEL,
  CASE_STATUS_BADGE,
} from '@/shared/enums/status-labels';
import { CaseStatus } from '@/shared/enums/generated';
import { BTN_PRIMARY, A11Y_FOCUS_RING } from '@/constants/styles';
import { StatsCardsStrip, type StatCard } from '@/components/shared/StatsCardsStrip';
import { getCaseStatusIcon } from '@/shared/enums/status-icons';
import { formatVNDate } from '@/lib/dates';
import { useBulkSelection } from '@/features/_shared/bulk/useBulkSelection';
import { BulkActionBar } from '@/features/_shared/bulk/BulkActionBar';
import { buildCasesAdapter } from '@/features/_shared/bulk/adapters/cases';
import type { BulkAction, BulkResult, BulkAdapter } from '@/features/_shared/bulk/types';
import { AlertCircle, X } from 'lucide-react';
// v0.63 PR1b — registry-driven row actions + advanced filters
import { RowActions } from '@/features/_shared/row-actions/RowActions';
import { Filters } from '@/features/_shared/list-filters/Filters';
import { useListFilters } from '@/features/_shared/list-filters/useListFilters';
import { useAssignModal } from '@/features/_shared/modals/AssignModalProvider';
import { useDeleteResourceModal } from '@/features/_shared/modals/DeleteResourceModalProvider';
import { usePermission } from '@/hooks/usePermission';
import type { ActionContext } from '@/features/_shared/row-actions/registry';
import { casesRowActions } from '@/features/cases/row-actions';
import { casesListFilters, type CaseFilterValue } from '@/features/cases/list-filters';

// AUTO-FIX #5 (security): validate URL status param against CaseStatus enum.
// Trust boundary — attacker URL `?cases_status=__proto__` cannot land in lookups.
const CASE_STATUS_VALUES = new Set<string>(Object.values(CaseStatus));
function isValidCaseStatus(value: string | null): value is CaseStatus {
  return value != null && CASE_STATUS_VALUES.has(value);
}

// AUTO-FIX #4 (i18n): axios English messages mapped to Vietnamese.
function getVietnameseErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status;
    if (status === 401) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';
    if (status === 403) return 'Bạn không có quyền xem dữ liệu này';
    if (status && status >= 500) return 'Lỗi máy chủ, vui lòng thử lại sau';
    const serverMsg = (e.response?.data as { message?: string } | undefined)?.message;
    if (serverMsg) return serverMsg;
    if (e.code === 'ECONNABORTED') return 'Quá thời gian chờ, vui lòng thử lại';
    return 'Không tải được danh sách vụ án';
  }
  return 'Lỗi không xác định';
}

interface CaseRow {
  id: string;
  caseCode: string | null;
  name: string;
  status: CaseStatus;
  unit: string | null;
  investigator: { firstName?: string; lastName?: string; username: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface CasesStatsResponse {
  total: number;
  byStatus: Record<CaseStatus, number>;
  /** Số theo NHÓM trạng thái, do server đếm (CASE_STATUS_GROUPS). */
  byGroup: Record<string, number>;
}

const PAGE_SIZE = 20;

/**
 * Giá trị "đang lọc bằng thứ khác" cho `activeValue` của thanh thẻ.
 *
 * Khi user lọc bằng CHIP trạng thái (không phải thẻ), nhóm là null → thẻ "Tổng"
 * (filterValue null) sẽ tự sáng và bị khoá, dù danh sách ĐANG bị lọc. Vừa nói dối vừa
 * khiến user không bấm "Tổng" để xoá lọc được. Sentinel này không khớp thẻ nào nên không
 * thẻ nào sáng, và "Tổng" bấm được để xoá sạch.
 */
const OTHER_FILTER_ACTIVE = '__other__';


/**
 * Số trên thẻ lấy thẳng từ `stats.byGroup` do server đếm — không cộng tay ở client nữa.
 * `filterValue` = khoá nhóm ở backend (`CASE_STATUS_GROUPS`). Thẻ "Tổng" mang `null`.
 */
function buildCasesCards(stats: CasesStatsResponse | null): StatCard[] {
  const g = stats?.byGroup;
  const at = (key: string) => (g ? (g[key] ?? 0) : null);
  return [
    { label: 'Tổng vụ án', value: stats?.total ?? null, filterValue: null, icon: Folder, iconBgClass: 'bg-[#003973]/10', iconColorClass: 'text-[#003973]', valueColorClass: 'text-[#003973]' },
    { label: 'Đang điều tra', value: at('dang-dieu-tra'), filterValue: 'dang-dieu-tra', icon: Clock, iconBgClass: 'bg-amber-100', iconColorClass: 'text-amber-600', valueColorClass: 'text-amber-600' },
    { label: 'Đã kết luận', value: at('da-ket-luan'), filterValue: 'da-ket-luan', icon: CheckCircle, iconBgClass: 'bg-green-100', iconColorClass: 'text-green-600', valueColorClass: 'text-green-600' },
    { label: 'Đình chỉ', value: at('dinh-chi'), filterValue: 'dinh-chi', icon: XCircle, iconBgClass: 'bg-red-100', iconColorClass: 'text-red-600', valueColorClass: 'text-red-600' },
    { label: 'Tạm đình chỉ', value: at('tam-dinh-chi'), filterValue: 'tam-dinh-chi', icon: PauseCircle, iconBgClass: 'bg-slate-100', iconColorClass: 'text-slate-600', valueColorClass: 'text-slate-600' },
  ];
}

export function CaseListPageShell() {
  const navigate = useNavigate();
  const url = useListPageUrlState('cases');

  // AUTO-FIX #5: validate URL status param immediately at trust boundary.
  const rawStatus = url.getParam('status');
  const statusFilter = isValidCaseStatus(rawStatus) ? rawStatus : null;
  // Nhóm trạng thái do bấm thẻ thống kê (backend validate bằng @IsIn).
  const groupFilter = url.getParam('statusGroup');
  // /codex review fix: clamp page >= 1. URL như ?cases_page=0 hoặc =-1
  // gây offset âm → backend 400 → stuck error state forever.
  const page = Math.max(1, url.getNumberParam('page', 1));
  const searchQuery = url.getParam('q') ?? '';

  // AUTO-FIX #1: debounce search query 300ms để tránh keystroke=2-API-calls.
  // Local input state syncs to URL on debounce timer. Cancelled via cleanup.
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const [rows, setRows] = useState<CaseRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<CasesStatsResponse | null>(null);
  const [tableState, setTableState] = useState<TableState>('loading');
  const [error, setError] = useState<string | undefined>();
  const [refetchCounter, setRefetchCounter] = useState(0);
  useListShortcuts({ onNew: () => navigate('/cases/new'), onRefresh: () => setRefetchCounter((n) => n + 1) });

  // v0.63 PR1b — Action context (perms + modal openers).
  const { canDispatch, canEdit, canDelete } = usePermission();
  const assignModal = useAssignModal();
  const deleteModal = useDeleteResourceModal();
  const actionCtx: ActionContext = useMemo(
    () => ({
      navigate,
      perms: {
        canDispatch,
        canEdit: canEdit('cases'),
        canDelete: canDelete('cases'),
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
    }),
    [navigate, canDispatch, canEdit, canDelete, assignModal, deleteModal],
  );

  // v0.63 PR1b — Advanced filter state + URL sync.
  const listFilters = useListFilters<CaseFilterValue>({
    prefix: 'cases',
    registry: casesListFilters,
  });
  const appliedFilters = listFilters.applied;

  /**
   * Param dùng CHUNG cho cả request danh sách lẫn request thống kê — một nguồn duy nhất
   * thì số trên thẻ không lệch khỏi danh sách được.
   *
   * Tên param phải KHỚP `QueryCasesDto`: `investigatorName` (không phải `investigator`).
   * Backend bật `forbidNonWhitelisted` nên gửi sai tên là 400 — lỗi đang tồn tại.
   */
  const baseQueryParams = useMemo(
    () => ({
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(appliedFilters.fromDate && { fromDate: appliedFilters.fromDate }),
      ...(appliedFilters.toDate && { toDate: appliedFilters.toDate }),
      ...(appliedFilters.unit && { unit: appliedFilters.unit }),
      ...(appliedFilters.investigator && { investigatorName: appliedFilters.investigator }),
      ...(appliedFilters.charges && { charges: appliedFilters.charges }),
    }),
    [debouncedSearch, appliedFilters],
  );

  /**
   * Khoá deps theo GIÁ TRỊ chứ không theo tham chiếu: `appliedFilters` đổi identity mỗi
   * lần URL đổi (react-router trả object mới), nên đưa thẳng `baseQueryParams` vào deps
   * sẽ khiến stats refetch mỗi lần bấm thẻ/đổi trang → nháy khung xương.
   */
  const baseQueryKey = JSON.stringify(baseQueryParams);

  const handleCardSelect = useCallback(
    (value: string | null) => {
      url.setParams({ statusGroup: value, status: null, page: '1' }, { history: 'push' });
    },
    [url],
  );

  // AUTO-FIX #1 (cont.): AbortController cancels in-flight requests on
  // dependency change → no stale state from late responses.
  const abortRef = useRef<AbortController | null>(null);

  // AUTO-FIX #2: split list vs stats fetch. List depends on status+page+search,
  // stats depends ONLY on search (status purposely stripped per backend
  // contract, page-independent by design). Stats no longer re-fires on page
  // navigation hoặc chip click.

  // Fetch LIST (status + page + search)
  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setTableState('loading');
    setError(undefined);

    const params = {
      ...baseQueryParams,
      ...(statusFilter && { status: statusFilter }),
      ...(groupFilter && { statusGroup: groupFilter }),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };

    api
      .get<{ data: CaseRow[]; total: number }>('/cases', { params, signal: ctrl.signal })
      .then((listRes) => {
        if (ctrl.signal.aborted) return;
        setRows(listRes.data.data);
        setTotalCount(listRes.data.total);
        if (listRes.data.total === 0) {
          setTableState(
            debouncedSearch || statusFilter || groupFilter ? 'empty-filtered' : 'empty',
          );
        } else {
          setTableState('ready');
        }
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        // AUTO-FIX #4: i18n error message.
        setError(getVietnameseErrorMessage(e));
        setTableState('error');
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, groupFilter, page, debouncedSearch, refetchCounter, appliedFilters]);

  // Stats dùng CHUNG baseQueryParams với danh sách (backend strip status/statusGroup).
  // Trước đây chỉ truyền `search` nên bật bộ lọc nâng cao là số trên thẻ lệch khỏi danh
  // sách. KHÔNG phụ thuộc groupFilter → bấm thẻ không refetch stats (tránh nháy skeleton).
  useEffect(() => {
    const ctrl = new AbortController();
    const statsParams = baseQueryParams;
    api
      .get<CasesStatsResponse>('/cases/stats', { params: statsParams, signal: ctrl.signal })
      .then((statsRes) => {
        if (ctrl.signal.aborted) return;
        setStats(statsRes.data);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        // Stats failure is non-blocking — chips just show no counts.
      });

    return () => ctrl.abort();
    // `baseQueryKey` (chuỗi JSON) chứ không phải `baseQueryParams`: object đổi identity
    // mỗi lần URL đổi nên dùng thẳng sẽ refetch stats mỗi lần bấm thẻ.
    // `refetchCounter` cần có: xoá/đổi trạng thái hàng loạt mà chỉ refetch danh sách thì
    // thẻ giữ số cũ → lệch với danh sách.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseQueryKey, refetchCounter]);

  const chipOptions = useMemo(
    () =>
      CASE_STATUS_CHIPS.map((c) => ({
        value: c.value,
        shortLabel: c.shortLabel,
        label: c.label,
        count: stats?.byStatus[c.value],
      })),
    [stats],
  );

  // /investigate v0.61 fix Bug 2 — bulk integration.
  const selection = useBulkSelection<CaseRow>({
    rowKey: 'id',
    pageRows: rows,
    totalCountMatchingFilter: totalCount,
  });
  const adapter = useMemo(
    () => buildCasesAdapter({ enableDelete: true }),
    [],
  );
  // Clear stale selection on URL change (Codex PR4 P2 pattern).
  const selectionClearRef = useRef(selection.clear);
  selectionClearRef.current = selection.clear;
  useEffect(() => {
    selectionClearRef.current();
  }, [statusFilter, groupFilter, page, debouncedSearch]);

  const [transientBanner, setTransientBanner] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const handleBulkSuccess = useCallback(
    (result: BulkResult | void, action: BulkAction<CaseRow>) => {
      if (action.key === 'export') {
        setTransientBanner({ kind: 'success', text: 'Đã xuất Excel' });
        return;
      }
      if (result && typeof result === 'object') {
        const { succeeded, skipped, failed } = result;
        const parts: string[] = [];
        if (succeeded?.length) parts.push(`Đã xử lý ${succeeded.length} vụ án`);
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
    (err: unknown, action: BulkAction<CaseRow>) => {
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

  const columns: ColumnDef<CaseRow>[] = useMemo(
    () => [
      {
        key: 'actions',
        header: 'Thao tác',
        width: '8rem',
        render: (r) => (
          <RowActions
            registry={casesRowActions}
            row={{
              id: r.id,
              status: r.status as unknown as string,
              caseCode: r.caseCode,
              name: r.name,
              updatedAt: r.updatedAt,
            }}
            ctx={actionCtx}
          />
        ),
      },
      {
        key: 'caseCode',
        header: 'Mã vụ án',
        render: (r) => r.caseCode ?? '—',
      },
      {
        key: 'name',
        header: 'Tên vụ',
        render: (r) => <span className="font-medium text-slate-800">{r.name}</span>,
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${CASE_STATUS_BADGE[r.status]}`}>
            {getCaseStatusIcon(r.status)}
            {CASE_STATUS_LABEL[r.status]}
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
        key: 'unit',
        header: 'Đơn vị',
        render: (r) => r.unit ?? '—',
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
      // Chip và thẻ loại trừ nhau — chọn trạng thái đơn lẻ thì bỏ nhóm đang lọc.
      url.setParams({ status: value, statusGroup: null, page: '1' });
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
    (statusFilter ? 1 : 0) + (groupFilter ? 1 : 0) + (searchQuery ? 1 : 0) + appliedFilterCount;

  return (
    <ListPageShell>
      <ListPageShell.Header
        icon={Folder}
        title="Danh sách vụ án"
        subtitle="Quản lý toàn bộ vụ án trong hệ thống"
        actions={
          <button
            type="button"
            onClick={() => navigate('/cases/new')}
            className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} flex items-center gap-2`}
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mới</span>
            <ShortcutHint action="newRecord" className="ml-1" />
          </button>
        }
      />
      <StatsCardsStrip
        cards={buildCasesCards(stats)}
        loading={stats == null}
        activeValue={groupFilter ?? (statusFilter ? OTHER_FILTER_ACTIVE : null)}
        onCardSelect={handleCardSelect}
      />
      <ListPageShell.StatusChips
        options={chipOptions}
        activeValue={statusFilter}
        onChange={handleStatusChange}
        totalCount={stats?.total}
        countsLoading={stats == null}
        groupActive={groupFilter != null}
      />
      <ListPageShell.Toolbar
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Tìm kiếm theo mã, tên, đơn vị..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        cardStyle
      >
        <Filters<CaseFilterValue>
          registry={casesListFilters}
          value={listFilters.draft}
          onChange={listFilters.setField}
          onApply={listFilters.apply}
          onReset={listFilters.reset}
          hasUnappliedChanges={listFilters.hasUnappliedChanges}
        />
      </ListPageShell.Toolbar>
      {transientBanner && (
        <div
          data-testid="cases-bulk-banner"
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
      <ListPageShell.Table<CaseRow>
        state={tableState}
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        title="Danh sách vụ án"
        sectionTitle="Danh sách vụ án"
        totalCount={totalCount}
        error={error}
        emptyState={{
          title: 'Chưa có vụ án nào',
          description: 'Tạo vụ án đầu tiên để bắt đầu.',
          actionLabel: 'Tạo vụ án mới',
          onAction: () => navigate('/cases/new'),
        }}
        emptyFilteredState={{ onClearFilters: handleResetFilters }}
        onRowClick={(r) => navigate(`/cases/${r.id}`)}
        bulkSelection={selection}
        bulkRowsLabel="vụ án"
        bulkRowLabel={(r) => `vụ án ${r.caseCode ?? r.name}`}
      />
      <ListPageShell.Pagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={handlePageChange}
      />
      <BulkActionBar<CaseRow>
        selection={selection}
        adapter={adapter as unknown as BulkAdapter<CaseRow>}
        pageRows={rows}
        onSuccess={handleBulkSuccess}
        onError={handleBulkError}
      />
    </ListPageShell>
  );
}

export default CaseListPageShell;
