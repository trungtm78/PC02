/**
 * PetitionListPageShell — PR2/T5 ListPageShell consumer cho Petitions.
 *
 * Mirror canonical CaseListPageShell + IncidentListPageShell pattern:
 * - useListPageUrlState('petitions') — status + page + search
 * - GET /api/v1/petitions/stats fetch + merge với PETITION_STATUS_CHIPS
 * - Toolbar search 300ms debounce
 * - Table state machine + overdue highlight (deadline < today)
 * - Pagination 20 rows/page
 *
 * Petition không có phase tabs (đơn giản hơn Incident — single workflow).
 *
 * KHÔNG thay thế production PetitionListPage — feature-flag swap ở PR3 sau soak.
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Plus } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import {
  ListPageShell,
  useListPageUrlState,
  type ColumnDef,
  type TableState,
} from '@/components/shared/ListPageShell';
import {
  PETITION_STATUS_CHIPS,
  PETITION_STATUS_LABEL,
  PETITION_STATUS_BADGE,
} from '@/shared/enums/status-labels';
import { PetitionStatus } from '@/shared/enums/generated';
import { BTN_PRIMARY, A11Y_FOCUS_RING, OVERDUE_ROW_HIGHLIGHT } from '@/constants/styles';
import { formatVNDate } from '@/lib/dates';

const PETITION_STATUS_VALUES = new Set<string>(Object.values(PetitionStatus));
function isValidPetitionStatus(value: string | null): value is PetitionStatus {
  return value != null && PETITION_STATUS_VALUES.has(value);
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
    return 'Không tải được danh sách đơn thư';
  }
  return 'Lỗi không xác định';
}

interface PetitionRow {
  id: string;
  stt: string;
  receivedDate: string;
  unit?: string | null;
  senderName: string;
  suspectedPerson?: string | null;
  status: PetitionStatus;
  deadline?: string | null;
  createdAt: string;
}

interface PetitionsStatsResponse {
  total: number;
  byStatus: Record<PetitionStatus, number>;
}

const PAGE_SIZE = 20;

function isOverdue(deadline?: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date(new Date().setHours(0, 0, 0, 0));
}

export function PetitionListPageShell() {
  const navigate = useNavigate();
  const url = useListPageUrlState('petitions');

  const rawStatus = url.getParam('status');
  const statusFilter = isValidPetitionStatus(rawStatus) ? rawStatus : null;
  const page = Math.max(1, url.getNumberParam('page', 1));
  const searchQuery = url.getParam('q') ?? '';

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const [rows, setRows] = useState<PetitionRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<PetitionsStatsResponse | null>(null);
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
      ...(debouncedSearch && { search: debouncedSearch }),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };

    api
      .get<{ data: PetitionRow[]; total: number }>('/petitions', { params, signal: ctrl.signal })
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
        setError(getVietnameseErrorMessage(e));
        setTableState('error');
      });

    return () => ctrl.abort();
  }, [statusFilter, page, debouncedSearch]);

  useEffect(() => {
    const ctrl = new AbortController();
    const statsParams = {
      ...(debouncedSearch && { search: debouncedSearch }),
    };
    api
      .get<PetitionsStatsResponse>('/petitions/stats', { params: statsParams, signal: ctrl.signal })
      .then((statsRes) => {
        if (ctrl.signal.aborted) return;
        setStats(statsRes.data);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
      });

    return () => ctrl.abort();
  }, [debouncedSearch]);

  const chipOptions = useMemo(
    () =>
      PETITION_STATUS_CHIPS.map((c) => ({
        value: c.value,
        shortLabel: c.shortLabel,
        label: c.label,
        count: stats?.byStatus[c.value],
      })),
    [stats],
  );

  const columns: ColumnDef<PetitionRow>[] = useMemo(
    () => [
      {
        key: 'stt',
        header: 'STT',
        render: (r) => <span className="font-mono text-xs text-slate-700">{r.stt}</span>,
      },
      {
        key: 'senderName',
        header: 'Người gửi',
        render: (r) => <span className="font-medium text-slate-800">{r.senderName}</span>,
      },
      {
        key: 'suspectedPerson',
        header: 'Đối tượng bị tố',
        render: (r) => r.suspectedPerson ?? '—',
      },
      {
        key: 'unit',
        header: 'Đơn vị',
        render: (r) => r.unit ?? '—',
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => (
          <span className={`inline-block px-2 py-0.5 rounded text-xs ${PETITION_STATUS_BADGE[r.status]}`}>
            {PETITION_STATUS_LABEL[r.status]}
          </span>
        ),
      },
      {
        key: 'receivedDate',
        header: 'Ngày nhận',
        render: (r) => formatVNDate(r.receivedDate),
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
        icon={Mail}
        title="Danh sách đơn thư"
        subtitle="Tố cáo, khiếu nại, kiến nghị, phản ánh — quản lý theo BLTTHS"
        actions={
          <button
            type="button"
            onClick={() => navigate('/petitions/new')}
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
        searchPlaceholder="Tìm kiếm theo STT, người gửi, đối tượng..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
      />
      <ListPageShell.Table<PetitionRow>
        state={tableState}
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        title="Danh sách đơn thư"
        totalCount={totalCount}
        error={error}
        emptyState={{
          title: 'Chưa có đơn thư nào',
          description: 'Tiếp nhận đơn thư đầu tiên để bắt đầu.',
          actionLabel: 'Tạo đơn thư mới',
          onAction: () => navigate('/petitions/new'),
        }}
        emptyFilteredState={{ onClearFilters: handleResetFilters }}
        onRowClick={(r) => navigate(`/petitions/${r.id}`)}
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

export default PetitionListPageShell;
