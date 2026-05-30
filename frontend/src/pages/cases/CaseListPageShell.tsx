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
import { Folder, Plus } from 'lucide-react';
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
import { formatVNDate } from '@/lib/dates';

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
}

const PAGE_SIZE = 20;

export function CaseListPageShell() {
  const navigate = useNavigate();
  const url = useListPageUrlState('cases');

  // AUTO-FIX #5: validate URL status param immediately at trust boundary.
  const rawStatus = url.getParam('status');
  const statusFilter = isValidCaseStatus(rawStatus) ? rawStatus : null;
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
      ...(statusFilter && { status: statusFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
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
          setTableState(debouncedSearch || statusFilter ? 'empty-filtered' : 'empty');
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
  }, [statusFilter, page, debouncedSearch]);

  // Fetch STATS — only on search change.
  // AUTO-FIX #3: pass ALL non-status filters (currently just search; future
  // investigator/unit/date filters auto-flow). Backend strips status.
  useEffect(() => {
    const ctrl = new AbortController();
    const statsParams = {
      ...(debouncedSearch && { search: debouncedSearch }),
      // Pagination omitted — stats is aggregation, not paginated
    };
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
  }, [debouncedSearch]);

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

  const columns: ColumnDef<CaseRow>[] = useMemo(
    () => [
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
          <span className={`inline-block px-2 py-0.5 rounded text-xs ${CASE_STATUS_BADGE[r.status]}`}>
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
    [],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleStatusChange = useCallback(
    (value: string | null) => {
      url.setParams({ status: value, page: '1' });
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
  }, [url]);

  const activeFilterCount = (statusFilter ? 1 : 0) + (searchQuery ? 1 : 0);

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
          </button>
        }
      />
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
        searchPlaceholder="Tìm kiếm theo mã, tên, đơn vị..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
      />
      <ListPageShell.Table<CaseRow>
        state={tableState}
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        title="Danh sách vụ án"
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
      />
      <ListPageShell.Pagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={handlePageChange}
      />
    </ListPageShell>
  );
}

export default CaseListPageShell;
