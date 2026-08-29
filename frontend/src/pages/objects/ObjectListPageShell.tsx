/**
 * ObjectListPageShell — PR5 ListPageShell consumer cho Đối tượng (Subjects).
 *
 * Polymorphic by `subjectType` prop: SUSPECT / VICTIM / WITNESS.
 * Mirrors LawyerListPageShell pattern (PR4) — alongside legacy ObjectListPage.
 *
 * Features:
 * - useListPageUrlState — prefix per subjectType ('objects' / 'victims' / 'witnesses')
 * - GET /api/v1/subjects?type={subjectType}
 * - Status chips (4 SubjectStatus) qua ListPageShell.StatusChips
 * - Bulk-delete via BulkActionBar + useBulkSelection + subjects adapter
 * - Codex P2 fixes from PR4 inherited: stale selection clear-on-URL-change,
 *   case column renders case.name (not caseCode)
 * - 300ms debounce + AbortController + page clamp + control-char strip
 * - Vietnamese error map
 *
 * Color theming preserved per subjectType (purple/rose/teal) via subtle accents.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Users,
  UserCheck,
  UserX,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  ListPageShell,
  ColumnPicker,
  useBoCucCot,
  useListPageUrlState,
  type ColumnDef,
  type TableState,
  getVietnameseErrorMessage,
  sanitizeStringParam,
} from '@/components/shared/ListPageShell';
import { useBulkSelection } from '@/features/_shared/bulk/useBulkSelection';
import { BulkActionBar } from '@/features/_shared/bulk/BulkActionBar';
import { buildSubjectsAdapter } from '@/features/_shared/bulk/adapters/subjects';
import type { BulkAction, BulkResult } from '@/features/_shared/bulk/types';
import {
  SubjectStatus,
  SubjectType,
  SUBJECT_STATUS_LABEL,
} from '@/shared/enums/subject-status';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { formatVNDate } from '@/lib/dates';

interface Subject {
  id: string;
  fullName: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  idNumber?: string;
  address?: string;
  phone?: string;
  caseId: string;
  type: SubjectType;
  status: SubjectStatus;
  createdAt: string;
  // Codex P2 fix from PR4: API returns case.{id,name,status} — NOT caseCode.
  case?: { id: string; name: string; status?: string };
}

interface TypeConfig {
  label: string;
  pageTitle: string;
  pageSubtitle: string;
  urlPrefix: string;
  resourceLabel: string;
  icon: typeof Users;
}

const TYPE_CONFIG: Record<SubjectType, TypeConfig> = {
  SUSPECT: {
    label: 'Bị can',
    pageTitle: 'Quản lý Đối tượng',
    pageSubtitle: 'Danh sách Bị can / Bị cáo trong các vụ án',
    urlPrefix: 'objects',
    resourceLabel: 'bị can',
    icon: Users,
  },
  VICTIM: {
    label: 'Bị hại',
    pageTitle: 'Quản lý Bị hại',
    pageSubtitle: 'Danh sách Bị hại trong các vụ án — Phòng PC02',
    urlPrefix: 'victims',
    resourceLabel: 'bị hại',
    icon: UserCheck,
  },
  WITNESS: {
    label: 'Nhân chứng',
    pageTitle: 'Quản lý Nhân chứng',
    pageSubtitle: 'Danh sách Nhân chứng trong các vụ án',
    urlPrefix: 'witnesses',
    resourceLabel: 'nhân chứng',
    icon: UserX,
  },
};

const SUBJECT_STATUS_VALUES = new Set<string>(Object.values(SubjectStatus));
function isValidSubjectStatus(v: string | null): v is SubjectStatus {
  return v != null && SUBJECT_STATUS_VALUES.has(v);
}

const SUBJECT_STATUS_CHIPS: ReadonlyArray<{
  value: SubjectStatus;
  shortLabel: string;
  label: string;
}> = (Object.keys(SUBJECT_STATUS_LABEL) as SubjectStatus[]).map((s) => ({
  value: s,
  shortLabel: SUBJECT_STATUS_LABEL[s],
  label: SUBJECT_STATUS_LABEL[s],
}));

const PAGE_SIZE = 20;

interface Props {
  subjectType?: SubjectType;
}

export function ObjectListPageShell({ subjectType = SubjectType.SUSPECT }: Props) {
  const cfg = TYPE_CONFIG[subjectType];
  const url = useListPageUrlState(cfg.urlPrefix);

  const rawStatus = url.getParam('status');
  const statusFilter = isValidSubjectStatus(rawStatus) ? rawStatus : null;
  const page = Math.max(1, url.getNumberParam('page', 1));
  const searchQuery = sanitizeStringParam(url.getParam('q'));

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [rows, setRows] = useState<Subject[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [tableState, setTableState] = useState<TableState>('loading');
  const [error, setError] = useState<string | undefined>();
  const [transientBanner, setTransientBanner] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchList = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setTableState('loading');
    setError(undefined);

    const params = new URLSearchParams();
    params.set('type', subjectType);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String((page - 1) * PAGE_SIZE));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);

    api
      .get<{ data: Subject[]; total: number }>(`/subjects?${params.toString()}`, {
        signal: ctrl.signal,
      })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        const data = res.data?.data ?? [];
        const total = res.data?.total ?? 0;
        setRows(data);
        setTotalCount(total);
        if (total === 0) {
          setTableState(debouncedSearch || statusFilter ? 'empty-filtered' : 'empty');
        } else {
          setTableState('ready');
        }
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        setError(getVietnameseErrorMessage(e, cfg.resourceLabel));
        setTableState('error');
      });
  }, [subjectType, page, debouncedSearch, statusFilter, cfg.resourceLabel]);

  useEffect(() => {
    fetchList();
    return () => abortRef.current?.abort();
  }, [fetchList]);

  // Page clamp (mirror PR3 UTDT pattern)
  useEffect(() => {
    if (totalCount === 0) return;
    const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (page > maxPage) url.setParam('page', '1');
  }, [totalCount, page, url]);

  const selection = useBulkSelection<Subject>({
    rowKey: 'id',
    pageRows: rows,
    totalCountMatchingFilter: totalCount,
  });

  // Codex P2 fix from PR4: clear selection synchronously on URL change.
  // /codex PR5 P2 extension: include `subjectType` — same shell can be reused
  // with different subjectType while page/q/status stay same (e.g. router
  // re-renders <ObjectListPageShell subjectType="VICTIM"/> after SUSPECT view).
  // Without this, selected suspect IDs would remain selected when bar switches
  // to "đối tượng bị hại" resourceLabel → user could submit bulk-delete for
  // SUSPECT IDs from the VICTIM context.
  const selectionClearRef = useRef(selection.clear);
  selectionClearRef.current = selection.clear;
  useEffect(() => {
    selectionClearRef.current();
  }, [subjectType, page, searchQuery, statusFilter]);

  const adapter = useMemo(
    () =>
      buildSubjectsAdapter({
        enableDelete: true,
        enableExport: true,
        resourceLabel: cfg.resourceLabel,
      }),
    [cfg.resourceLabel],
  );

  const chipOptions = useMemo(
    () =>
      SUBJECT_STATUS_CHIPS.map((c) => ({
        value: c.value,
        shortLabel: c.shortLabel,
        label: c.label,
        // No /subjects/stats endpoint yet — chip counts deferred
        count: undefined,
      })),
    [],
  );

  /**
   * Cột bảng Đối tượng — chuyển từ `<table>` tự dựng sang `ListPageShell.Table`.
   *
   * Trang này trước đây tự viết thẻ bảng nên không được hưởng kéo giãn / ẩn hiện / đổi thứ tự
   * cột. Chuyển sang bảng chung là để cán bộ thấy MỘT cách làm việc trên mọi màn danh sách,
   * chứ không phải màn này kéo được màn kia thì không.
   *
   * Bề rộng đo từ dữ liệu thật (28/08/2026): họ tên và tên vụ án là hai cột dài nhất.
   */
  const columns: ColumnDef<Subject>[] = useMemo(
    () => [
      { key: 'fullName', header: 'Họ tên', width: '16rem', optional: 'show',
        cellClassName: 'px-3 py-2 text-sm font-medium text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.fullName },
      { key: 'idNumber', header: 'CCCD', width: '10rem', optional: 'show',
        cellClassName: 'px-3 py-2 text-xs font-mono text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.idNumber ?? '—' },
      // Cột này hiện `case.name` chứ KHÔNG phải `caseCode` — Codex đã sửa ở PR4, giữ nguyên.
      { key: 'case', header: 'Vụ án', width: '20rem', optional: 'show',
        cellClassName: 'px-3 py-2 text-sm text-blue-700 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.case?.name ?? '—' },
      { key: 'status', header: 'Trạng thái', width: '11rem', optional: 'show',
        cellClassName: 'px-3 py-2 text-xs whitespace-nowrap overflow-hidden',
        render: (r) => (
          <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
            {SUBJECT_STATUS_LABEL[r.status] ?? r.status}
          </span>
        ) },
      { key: 'createdAt', header: 'Ngày tạo', width: '9rem', optional: 'show',
        cellClassName: 'px-3 py-2 text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => formatVNDate(r.createdAt) },
    ],
    [],
  );

  const {
    coGhiDeBeRong,
    visibleColumns,
    toggleableColumns,
    isVisible,
    batTat,
    datBeRong,
    xoaBeRong,
    doiCho,
    datLai,
  } = useBoCucCot('objects', columns);

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

  const handleBulkSuccess = useCallback(
    (result: BulkResult | void, action: BulkAction<Subject>) => {
      if (action.key === 'delete' && result && typeof result === 'object') {
        const { succeeded, skipped, failed } = result;
        const parts: string[] = [];
        if (succeeded?.length) parts.push(`Đã xóa ${succeeded.length} ${cfg.resourceLabel}`);
        if (skipped?.length) parts.push(`Bỏ qua ${skipped.length} (không đủ quyền/đã xóa)`);
        if (failed?.length) parts.push(`Lỗi ${failed.length}`);
        setTransientBanner({
          kind: failed?.length ? 'error' : 'success',
          text: parts.join(' · ') || 'Hoàn tất xóa hàng loạt',
        });
        fetchList();
      }
    },
    [fetchList, cfg.resourceLabel],
  );

  const handleBulkError = useCallback(
    (err: unknown, action: BulkAction<Subject>) => {
      setTransientBanner({
        kind: 'error',
        text: `Thao tác "${action.label}" thất bại: ${getVietnameseErrorMessage(err, cfg.resourceLabel)}`,
      });
    },
    [cfg.resourceLabel],
  );

  useEffect(() => {
    if (!transientBanner) return;
    const t = setTimeout(() => setTransientBanner(null), 5000);
    return () => clearTimeout(t);
  }, [transientBanner]);

  const Icon = cfg.icon;

  return (
    <>
      <ListPageShell>
        <ListPageShell.Header
          icon={Icon}
          title={cfg.pageTitle}
          subtitle={cfg.pageSubtitle}
        />
        <ListPageShell.StatusChips
          options={chipOptions}
          activeValue={statusFilter}
          onChange={handleStatusChange}
          totalCount={totalCount}
          countsLoading={tableState === 'loading'}
          countsUnknown={tableState === 'error'}
        />
        <ListPageShell.Toolbar
          searchValue={searchQuery}
          onSearchChange={handleSearchChange}
          searchPlaceholder={`Tìm theo họ tên, CCCD, địa chỉ...`}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          columnPicker={
            <ColumnPicker
              columns={toggleableColumns}
              isVisible={isVisible}
              onToggle={batTat}
              onReset={datLai}
              onDoiCho={doiCho}
            />
          }
        />

        {transientBanner && (
          <div
            data-testid="subjects-bulk-banner"
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

        <ListPageShell.Table<Subject>
          state={tableState}
          fixedLayout
          onKeoGian={datBeRong}
          onVeMacDinhCot={xoaBeRong}
          datTongBeRong={coGhiDeBeRong}
          columns={visibleColumns}
          data={rows}
          rowKey={(r) => r.id}
          title={cfg.resourceLabel}
          totalCount={totalCount}
          error={error}
          bulkSelection={selection}
          bulkRowsLabel={cfg.resourceLabel}
          // Giữ NGUYÊN nhãn cũ của ô tick ("Chọn bị can Nguyễn Văn A"): đây là thứ trình đọc
          // màn hình đọc lên, đổi nó là đổi trải nghiệm của người dùng bàn phím mà không ai
          // yêu cầu.
          bulkRowLabel={(r) => `${cfg.resourceLabel} ${r.fullName}`}
          emptyState={{
            title: `Chưa có ${cfg.resourceLabel} nào`,
            description: `Thêm ${cfg.resourceLabel} qua màn hình vụ án.`,
          }}
          emptyFilteredState={{ onClearFilters: handleResetFilters }}
        />

        <ListPageShell.Pagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={handlePageChange}
        />
      </ListPageShell>

      <BulkActionBar
        selection={selection}
        adapter={adapter}
        pageRows={rows}
        onSuccess={handleBulkSuccess}
        onError={handleBulkError}
      />
    </>
  );
}

export default ObjectListPageShell;
