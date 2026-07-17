/**
 * ComprehensiveListPageShell — PR2/T6 ListPageShell consumer cho Tra cứu tổng hợp.
 *
 * Tổng hợp 3 entity types (Vụ án / Vụ việc / Đơn thư) trong 1 list duy nhất.
 *
 * Pattern decisions (per plan):
 * - StatusChips dùng làm RECORD_TYPE filter (CASE / INCIDENT / PETITION), không
 *   phải status enum — semantic phù hợp với UI hiện tại (anh phân biệt theo loại
 *   record, không theo status).
 * - "Tất cả" chip fetch parallel 3 endpoints, merge + sort theo createdAt desc.
 *   Preview-only: tối đa MERGE_PREVIEW_SIZE rows mới nhất từ mỗi entity → UI cap
 *   pagination tại merged.length thay vì sum server totals (review fix C1).
 * - Counts derived từ list response `.total` khi fan-out, KHÔNG fire thêm stats
 *   endpoint calls — tiết kiệm 3 request/keystroke (review fix C2). Riêng single-type
 *   mode dùng /stats endpoint cho future per-status drill-down.
 *
 * KHÔNG thay thế production ComprehensiveListPage — feature-flag swap ở PR3.
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListShortcuts } from '@/hooks/useListShortcuts';
import { Layers, Plus } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import {
  ListPageShell,
  useListPageUrlState,
  type ColumnDef,
  type TableState,
} from '@/components/shared/ListPageShell';
import {
  CASE_STATUS_LABEL,
  CASE_STATUS_BADGE,
  INCIDENT_STATUS_LABEL,
  INCIDENT_STATUS_BADGE,
  PETITION_STATUS_LABEL,
  PETITION_STATUS_BADGE,
  BADGE_DEFAULT,
} from '@/shared/enums/status-labels';
import {
  CaseStatus,
  IncidentStatus,
  PetitionStatus,
} from '@/shared/enums/generated';
import { BTN_PRIMARY, A11Y_FOCUS_RING } from '@/constants/styles';
import { formatVNDate } from '@/lib/dates';
// v0.66 PR4 — polyglot registry-driven row actions + advanced filters
import { RowActions } from '@/features/_shared/row-actions/RowActions';
import { Filters } from '@/features/_shared/list-filters/Filters';
import { useListFilters } from '@/features/_shared/list-filters/useListFilters';
import { useAssignModal } from '@/features/_shared/modals/AssignModalProvider';
import { useDeleteResourceModal } from '@/features/_shared/modals/DeleteResourceModalProvider';
import { usePermission } from '@/hooks/usePermission';
import type { ActionContext } from '@/features/_shared/row-actions/registry';
import { comprehensiveRowActions } from '@/features/comprehensive/row-actions';
import { comprehensiveListFilters, type ComprehensiveFilterValue } from '@/features/comprehensive/list-filters';

const RECORD_TYPE = {
  CASE: 'CASE',
  INCIDENT: 'INCIDENT',
  PETITION: 'PETITION',
} as const;
type RecordType = (typeof RECORD_TYPE)[keyof typeof RECORD_TYPE];

const RECORD_TYPE_VALUES = new Set<string>(Object.values(RECORD_TYPE));
function isValidRecordType(value: string | null): value is RecordType {
  return value != null && RECORD_TYPE_VALUES.has(value);
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
    return 'Không tải được dữ liệu tra cứu';
  }
  return 'Lỗi không xác định';
}

interface UnifiedRow {
  id: string;
  recordType: RecordType;
  typeLabel: string;
  caseNumber: string;
  name: string;
  statusLabel: string;
  statusBadge: string;
  createdBy: string;
  receivedDate: string;
  createdAt: string;
  district?: string;
}

const PAGE_SIZE = 20;
// Fan-out preview cap — limit per-entity rows fetched khi "Tất cả".
// 50 × 3 = 150 rows merge buffer, paginated client-side. Review fix C1.
const MERGE_PREVIEW_PER_ENTITY = 50;

function caseToUnified(c: {
  id: string;
  caseCode?: string | null;
  name: string;
  status: CaseStatus;
  unit?: string | null;
  investigator?: { firstName?: string; lastName?: string; username: string } | null;
  createdAt: string;
}): UnifiedRow {
  return {
    id: c.id,
    recordType: RECORD_TYPE.CASE,
    typeLabel: 'Vụ án',
    caseNumber: c.caseCode ?? c.id.slice(0, 8).toUpperCase(),
    name: c.name,
    statusLabel: CASE_STATUS_LABEL[c.status] ?? c.status,
    statusBadge: CASE_STATUS_BADGE[c.status] ?? BADGE_DEFAULT,
    createdBy: c.investigator
      ? [c.investigator.firstName, c.investigator.lastName].filter(Boolean).join(' ') ||
        c.investigator.username
      : '—',
    receivedDate: c.createdAt,
    createdAt: c.createdAt,
    district: c.unit ?? undefined,
  };
}

function incidentToUnified(i: {
  id: string;
  code: string;
  name: string;
  status: IncidentStatus;
  donViGiaiQuyet?: string | null;
  investigator?: { firstName?: string; lastName?: string; username: string } | null;
  createdAt: string;
}): UnifiedRow {
  return {
    id: i.id,
    recordType: RECORD_TYPE.INCIDENT,
    typeLabel: 'Vụ việc',
    caseNumber: i.code,
    name: i.name,
    statusLabel: INCIDENT_STATUS_LABEL[i.status] ?? i.status,
    statusBadge: INCIDENT_STATUS_BADGE[i.status] ?? BADGE_DEFAULT,
    createdBy: i.investigator
      ? [i.investigator.firstName, i.investigator.lastName].filter(Boolean).join(' ') ||
        i.investigator.username
      : '—',
    receivedDate: i.createdAt,
    createdAt: i.createdAt,
    district: i.donViGiaiQuyet ?? undefined,
  };
}

function petitionToUnified(p: {
  id: string;
  stt: string;
  senderName: string;
  status: PetitionStatus;
  unit?: string | null;
  receivedDate: string;
  createdAt: string;
}): UnifiedRow {
  return {
    id: p.id,
    recordType: RECORD_TYPE.PETITION,
    typeLabel: 'Đơn thư',
    caseNumber: p.stt,
    name: p.senderName,
    statusLabel: PETITION_STATUS_LABEL[p.status] ?? p.status,
    statusBadge: PETITION_STATUS_BADGE[p.status] ?? BADGE_DEFAULT,
    createdBy: '—',
    receivedDate: p.receivedDate,
    createdAt: p.createdAt,
    district: p.unit ?? undefined,
  };
}

export function ComprehensiveListPageShell() {
  const navigate = useNavigate();
  const url = useListPageUrlState('comp');

  const rawType = url.getParam('type');
  const typeFilter = isValidRecordType(rawType) ? rawType : null;
  const page = Math.max(1, url.getNumberParam('page', 1));
  const searchQuery = url.getParam('q') ?? '';

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState<{
    cases: number | null;
    incidents: number | null;
    petitions: number | null;
  }>({ cases: null, incidents: null, petitions: null });
  const [tableState, setTableState] = useState<TableState>('loading');
  const [error, setError] = useState<string | undefined>();

  const abortRef = useRef<AbortController | null>(null);

  // v0.66 PR4 — Action context + advanced filters.
  const { canDispatch, canEdit, canDelete } = usePermission();
  const assignModal = useAssignModal();
  const deleteModal = useDeleteResourceModal();
  const [refetchCounter, setRefetchCounter] = useState(0);
  useListShortcuts({ onNew: () => navigate('/cases/new'), onRefresh: () => setRefetchCounter((n) => n + 1) });
  const actionCtx: ActionContext = useMemo(
    () => ({
      navigate,
      perms: {
        canDispatch,
        // canEdit/canDelete checked per resource at action level — caller passes general.
        canEdit: canEdit('cases') || canEdit('incidents') || canEdit('petitions'),
        canDelete: canDelete('cases') || canDelete('incidents') || canDelete('petitions'),
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
  const listFilters = useListFilters<ComprehensiveFilterValue>({
    prefix: 'comprehensive',
    registry: comprehensiveListFilters,
  });
  const appliedFilters = listFilters.applied;

  // Fetch LIST — fan-out theo typeFilter
  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setTableState('loading');
    setError(undefined);

    const searchParam = debouncedSearch ? { search: debouncedSearch } : {};

    const fetchAll = async () => {
      try {
        if (typeFilter === RECORD_TYPE.CASE) {
          const res = await api.get<{ data: Parameters<typeof caseToUnified>[0][]; total: number }>(
            '/cases',
            {
              params: {
                ...searchParam,
                limit: PAGE_SIZE,
                offset: (page - 1) * PAGE_SIZE,
              },
              signal: ctrl.signal,
            },
          );
          if (ctrl.signal.aborted) return;
          setRows(res.data.data.map(caseToUnified));
          setTotalCount(res.data.total);
          setTableState(
            res.data.total === 0
              ? debouncedSearch || typeFilter
                ? 'empty-filtered'
                : 'empty'
              : 'ready',
          );
          return;
        }
        if (typeFilter === RECORD_TYPE.INCIDENT) {
          const res = await api.get<{
            data: Parameters<typeof incidentToUnified>[0][];
            total: number;
          }>('/incidents', {
            params: { ...searchParam, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
            signal: ctrl.signal,
          });
          if (ctrl.signal.aborted) return;
          setRows(res.data.data.map(incidentToUnified));
          setTotalCount(res.data.total);
          setTableState(
            res.data.total === 0
              ? debouncedSearch || typeFilter
                ? 'empty-filtered'
                : 'empty'
              : 'ready',
          );
          return;
        }
        if (typeFilter === RECORD_TYPE.PETITION) {
          const res = await api.get<{
            data: Parameters<typeof petitionToUnified>[0][];
            total: number;
          }>('/petitions', {
            params: { ...searchParam, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
            signal: ctrl.signal,
          });
          if (ctrl.signal.aborted) return;
          setRows(res.data.data.map(petitionToUnified));
          setTotalCount(res.data.total);
          setTableState(
            res.data.total === 0
              ? debouncedSearch || typeFilter
                ? 'empty-filtered'
                : 'empty'
              : 'ready',
          );
          return;
        }
        // "Tất cả" — fan-out + merge + client paginate. Preview-only mode:
        // - Fetch top MERGE_PREVIEW_PER_ENTITY mới nhất từ mỗi entity (server-sorted by createdAt desc by default)
        // - Pagination capped tại merged.length (review fix C1) thay vì sum server totals
        //   → user không bao giờ thấy "Trang 4/150 (empty)" do over-report
        // - Counts derived từ list .total (review fix C2) — KHÔNG fire stats endpoints riêng
        //   trong fan-out mode → tiết kiệm 3 request/keystroke
        const [cRes, iRes, pRes] = await Promise.all([
          api.get<{ data: Parameters<typeof caseToUnified>[0][]; total: number }>('/cases', {
            params: { ...searchParam, limit: MERGE_PREVIEW_PER_ENTITY },
            signal: ctrl.signal,
          }),
          api.get<{ data: Parameters<typeof incidentToUnified>[0][]; total: number }>(
            '/incidents',
            { params: { ...searchParam, limit: MERGE_PREVIEW_PER_ENTITY }, signal: ctrl.signal },
          ),
          api.get<{ data: Parameters<typeof petitionToUnified>[0][]; total: number }>(
            '/petitions',
            { params: { ...searchParam, limit: MERGE_PREVIEW_PER_ENTITY }, signal: ctrl.signal },
          ),
        ]);
        if (ctrl.signal.aborted) return;
        const merged: UnifiedRow[] = [
          ...cRes.data.data.map(caseToUnified),
          ...iRes.data.data.map(incidentToUnified),
          ...pRes.data.data.map(petitionToUnified),
        ].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        // Derive counts directly từ list response totals — saves 3 stats requests.
        setCounts({
          cases: cRes.data.total,
          incidents: iRes.data.total,
          petitions: pRes.data.total,
        });
        const startIdx = (page - 1) * PAGE_SIZE;
        setRows(merged.slice(startIdx, startIdx + PAGE_SIZE));
        // Cap totalCount tại merged.length — pagination không vượt qua preview buffer.
        setTotalCount(merged.length);
        setTableState(
          merged.length === 0 ? (debouncedSearch ? 'empty-filtered' : 'empty') : 'ready',
        );
      } catch (e: unknown) {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        setError(getVietnameseErrorMessage(e));
        setTableState('error');
      }
    };

    void fetchAll();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, page, debouncedSearch, refetchCounter, appliedFilters]);

  // Stats fan-out CHỈ khi typeFilter được chọn — single-type mode cần stats endpoint
  // cho future per-status drill-down. Khi typeFilter == null (Tất cả), counts
  // đã derived từ list response totals trong fetchAll → không cần thêm 3 requests.
  // Review fix C2: tiết kiệm 3 requests/keystroke trong "Tất cả" mode.
  useEffect(() => {
    if (typeFilter == null) return; // Tất cả mode — counts come from list responses
    const ctrl = new AbortController();
    const statsParams = debouncedSearch ? { search: debouncedSearch } : {};

    const safeGet = async (path: string) => {
      try {
        const res = await api.get<{ total: number }>(path, {
          params: statsParams,
          signal: ctrl.signal,
        });
        return res.data.total;
      } catch {
        return null;
      }
    };
    Promise.all([
      safeGet('/cases/stats'),
      safeGet('/incidents/stats'),
      safeGet('/petitions/stats'),
    ]).then(([cases, incidents, petitions]) => {
      if (ctrl.signal.aborted) return;
      setCounts({ cases, incidents, petitions });
    });
    return () => ctrl.abort();
  }, [debouncedSearch, typeFilter]);

  const chipOptions = useMemo(
    () => [
      {
        value: RECORD_TYPE.CASE,
        shortLabel: 'Vụ án',
        label: 'Vụ án',
        count: counts.cases ?? undefined,
      },
      {
        value: RECORD_TYPE.INCIDENT,
        shortLabel: 'Vụ việc',
        label: 'Vụ việc',
        count: counts.incidents ?? undefined,
      },
      {
        value: RECORD_TYPE.PETITION,
        shortLabel: 'Đơn thư',
        label: 'Đơn thư',
        count: counts.petitions ?? undefined,
      },
    ],
    [counts],
  );

  const totalChipCount = useMemo(() => {
    if (counts.cases == null && counts.incidents == null && counts.petitions == null) {
      return undefined;
    }
    return (counts.cases ?? 0) + (counts.incidents ?? 0) + (counts.petitions ?? 0);
  }, [counts]);

  const columns: ColumnDef<UnifiedRow>[] = useMemo(
    () => [
      {
        key: 'actions',
        header: 'Thao tác',
        width: '8rem',
        render: (r) => (
          <RowActions
            registry={comprehensiveRowActions}
            row={{
              id: r.id,
              recordType: r.recordType,
              caseNumber: r.caseNumber,
              name: r.name,
            }}
            ctx={actionCtx}
          />
        ),
      },
      {
        key: 'typeLabel',
        header: 'Loại',
        render: (r) => (
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {r.typeLabel}
          </span>
        ),
      },
      {
        key: 'caseNumber',
        header: 'Mã hồ sơ',
        render: (r) => <span className="font-mono text-xs text-slate-700">{r.caseNumber}</span>,
      },
      {
        key: 'name',
        header: 'Tên / Người gửi',
        render: (r) => <span className="font-medium text-slate-800">{r.name}</span>,
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => (
          <span className={`inline-block px-2 py-0.5 rounded text-xs ${r.statusBadge}`}>
            {r.statusLabel}
          </span>
        ),
      },
      {
        key: 'createdBy',
        header: 'Người phụ trách',
        render: (r) => r.createdBy,
      },
      {
        key: 'district',
        header: 'Đơn vị',
        render: (r) => r.district ?? '—',
      },
      {
        key: 'receivedDate',
        header: 'Ngày tiếp nhận',
        render: (r) => formatVNDate(r.receivedDate),
      },
    ],
    [actionCtx],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleTypeChange = useCallback(
    (value: string | null) => {
      url.setParams({ type: value, page: '1' });
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
  const activeFilterCount = (typeFilter ? 1 : 0) + (searchQuery ? 1 : 0) + appliedFilterCount;

  const handleRowClick = useCallback(
    (r: UnifiedRow) => {
      if (r.recordType === RECORD_TYPE.CASE) navigate(`/cases/${r.id}`);
      else if (r.recordType === RECORD_TYPE.INCIDENT) navigate(`/incidents/${r.id}`);
      else navigate(`/petitions/${r.id}`);
    },
    [navigate],
  );

  return (
    <ListPageShell>
      <ListPageShell.Header
        icon={Layers}
        title="Tra cứu tổng hợp"
        subtitle="Tổng hợp Vụ án, Vụ việc và Đơn thư trên một danh sách duy nhất"
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
        activeValue={typeFilter}
        onChange={handleTypeChange}
        totalCount={totalChipCount}
        countsLoading={counts.cases == null && counts.incidents == null && counts.petitions == null}
      />
      <ListPageShell.Toolbar
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Tìm kiếm theo mã, tên, người gửi..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
      >
        <Filters<ComprehensiveFilterValue>
          registry={comprehensiveListFilters}
          value={listFilters.draft}
          onChange={listFilters.setField}
          onApply={listFilters.apply}
          onReset={listFilters.reset}
          hasUnappliedChanges={listFilters.hasUnappliedChanges}
        />
      </ListPageShell.Toolbar>
      <ListPageShell.Table<UnifiedRow>
        state={tableState}
        columns={columns}
        data={rows}
        rowKey={(r) => `${r.recordType}-${r.id}`}
        title="Tra cứu tổng hợp"
        totalCount={totalCount}
        error={error}
        emptyState={{
          title: 'Chưa có hồ sơ nào',
          description: 'Tạo hồ sơ đầu tiên trong hệ thống.',
          actionLabel: 'Tạo vụ án mới',
          onAction: () => navigate('/cases/new'),
        }}
        emptyFilteredState={{ onClearFilters: handleResetFilters }}
        onRowClick={handleRowClick}
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

export default ComprehensiveListPageShell;
