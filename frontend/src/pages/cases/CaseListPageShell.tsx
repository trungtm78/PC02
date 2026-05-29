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
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Plus } from 'lucide-react';
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

  const statusFilter = url.getParam('status') as CaseStatus | null;
  const page = url.getNumberParam('page', 1);
  const searchQuery = url.getParam('q') ?? '';

  const [rows, setRows] = useState<CaseRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<CasesStatsResponse | null>(null);
  const [tableState, setTableState] = useState<TableState>('loading');
  const [error, setError] = useState<string | undefined>();

  // Fetch list + stats together. Stats scoped to non-status filters → re-fetch
  // khi search hoặc page thay đổi, nhưng KHÔNG khi status filter alone đổi.
  useEffect(() => {
    let cancelled = false;
    setTableState('loading');
    setError(undefined);

    const params = {
      ...(statusFilter && { status: statusFilter }),
      ...(searchQuery && { search: searchQuery }),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };

    Promise.all([
      api.get<{ data: CaseRow[]; total: number }>('/cases', { params }),
      api.get<CasesStatsResponse>('/cases/stats', {
        params: { ...(searchQuery && { search: searchQuery }) },
      }),
    ])
      .then(([listRes, statsRes]) => {
        if (cancelled) return;
        setRows(listRes.data.data);
        setTotalCount(listRes.data.total);
        setStats(statsRes.data);
        if (listRes.data.total === 0) {
          setTableState(searchQuery || statusFilter ? 'empty-filtered' : 'empty');
        } else {
          setTableState('ready');
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Lỗi không xác định';
        setError(msg);
        setTableState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, page, searchQuery]);

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
        countsLoading={stats == null && tableState === 'loading'}
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
