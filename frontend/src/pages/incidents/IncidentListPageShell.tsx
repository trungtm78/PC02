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
import { FileSearch, Plus } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import {
  ListPageShell,
  useListPageUrlState,
  type ColumnDef,
  type TableState,
} from '@/components/shared/ListPageShell';
import {
  INCIDENT_STATUS_CHIPS,
  INCIDENT_STATUS_LABEL,
  INCIDENT_STATUS_BADGE,
} from '@/shared/enums/status-labels';
import { IncidentStatus } from '@/shared/enums/generated';
import { BTN_PRIMARY, A11Y_FOCUS_RING, OVERDUE_ROW_HIGHLIGHT } from '@/constants/styles';
import { formatVNDate } from '@/lib/dates';

// Trust boundary — URL `?incidents_status=__proto__` must not land in lookups.
const INCIDENT_STATUS_VALUES = new Set<string>(Object.values(IncidentStatus));
function isValidIncidentStatus(value: string | null): value is IncidentStatus {
  return value != null && INCIDENT_STATUS_VALUES.has(value);
}

// Phase = grouping of statuses per BCA TT28/2020 4-stage workflow.
// Map backend QueryIncidentsDto.phase values.
const PHASE_VALUES = ['TIEP_NHAN', 'XAC_MINH', 'KET_QUA', 'TAM_DINH_CHI'] as const;
type IncidentPhase = (typeof PHASE_VALUES)[number];
const PHASE_LABEL: Record<IncidentPhase, string> = {
  TIEP_NHAN: 'Tiếp nhận',
  XAC_MINH: 'Xác minh',
  KET_QUA: 'Kết quả',
  TAM_DINH_CHI: 'Tạm đình chỉ',
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
  const [error, setError] = useState<string | undefined>();

  const abortRef = useRef<AbortController | null>(null);

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
  }, [statusFilter, phaseFilter, page, debouncedSearch]);

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

  const columns: ColumnDef<IncidentRow>[] = useMemo(
    () => [
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
          <span className={`inline-block px-2 py-0.5 rounded text-xs ${INCIDENT_STATUS_BADGE[r.status]}`}>
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
    [],
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
  }, [url]);

  const activeFilterCount =
    (statusFilter ? 1 : 0) + (phaseFilter ? 1 : 0) + (searchQuery ? 1 : 0);

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
      />
      <ListPageShell.Table<IncidentRow>
        state={tableState}
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        title="Danh sách vụ việc"
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

export default IncidentListPageShell;
