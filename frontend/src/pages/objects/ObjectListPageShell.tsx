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
  Plus,
  Users,
  UserCheck,
  UserX,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  ListPageShell,
  useListPageUrlState,
  type TableState,
  getVietnameseErrorMessage,
  sanitizeStringParam,
} from '@/components/shared/ListPageShell';
import { useBulkSelection } from '@/features/_shared/bulk/useBulkSelection';
import {
  BulkSelectionHeaderCell,
  BulkSelectionRowCell,
} from '@/features/_shared/bulk/BulkSelectionColumn';
import { BulkActionBar } from '@/features/_shared/bulk/BulkActionBar';
import { buildSubjectsAdapter } from '@/features/_shared/bulk/adapters/subjects';
import type { BulkAction, BulkResult } from '@/features/_shared/bulk/types';
import {
  SubjectStatus,
  SubjectType,
  SUBJECT_STATUS_LABEL,
} from '@/shared/enums/subject-status';
import { A11Y_FOCUS_RING, BTN_PRIMARY } from '@/constants/styles';
import { formatVNDate } from '@/lib/dates';
import { usePermission } from '@/hooks/usePermission';
import { useNavigate } from 'react-router-dom';

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

const CREATE_PATH: Record<string, string> = {
  [SubjectType.SUSPECT]: '/people/suspects/new',
  [SubjectType.VICTIM]: '/people/victims/new',
  [SubjectType.WITNESS]: '/people/witnesses/new',
};

export function ObjectListPageShell({ subjectType = SubjectType.SUSPECT }: Props) {
  const navigate = useNavigate();
  const { canCreate } = usePermission();
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
          actions={
            /* D2/ND-16 — ba màn hình này trước đây chỉ liệt kê, không có đường
               nào tạo mới. Gate trên chính quyền mà `POST /subjects` đòi. */
            canCreate('objects') ? (
              <button
                type="button"
                onClick={() => navigate(`${CREATE_PATH[subjectType]}`)}
                data-testid="btn-create-subject"
                className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} flex items-center gap-2`}
              >
                <Plus className="w-4 h-4" />
                <span>Thêm {cfg.resourceLabel}</span>
              </button>
            ) : null
          }
        />
        <ListPageShell.StatusChips
          options={chipOptions}
          activeValue={statusFilter}
          onChange={handleStatusChange}
          totalCount={totalCount}
          countsLoading={tableState === 'loading'}
        />
        <ListPageShell.Toolbar
          searchValue={searchQuery}
          onSearchChange={handleSearchChange}
          searchPlaceholder={`Tìm theo họ tên, CCCD, địa chỉ...`}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
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

        <div className="px-4 py-3" data-testid="subjects-shell-table-wrap">
          {tableState === 'loading' && (
            <div
              data-testid="list-page-shell-table-loading"
              className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500"
            >
              Đang tải...
            </div>
          )}
          {tableState === 'error' && (
            <div
              data-testid="list-page-shell-table-error"
              className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error ?? 'Lỗi không xác định'}
            </div>
          )}
          {tableState === 'empty' && (
            <div
              data-testid="list-page-shell-table-empty"
              className="bg-white border border-slate-200 rounded-lg p-12 text-center"
            >
              <p className="text-slate-700 font-medium">Chưa có {cfg.resourceLabel} nào</p>
              <p className="text-sm text-slate-500 mt-1">
                Thêm {cfg.resourceLabel} qua màn hình vụ án.
              </p>
            </div>
          )}
          {tableState === 'empty-filtered' && (
            <div
              data-testid="list-page-shell-table-empty-filtered"
              className="bg-white border border-slate-200 rounded-lg p-12 text-center"
            >
              <p className="text-slate-700 font-medium">Không có {cfg.resourceLabel} phù hợp</p>
              <button
                type="button"
                onClick={handleResetFilters}
                className={`mt-3 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 rounded ${A11Y_FOCUS_RING}`}
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
          {tableState === 'ready' && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm" data-testid="subjects-shell-table">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <BulkSelectionHeaderCell
                      selection={selection}
                      totalRowsLabel={cfg.resourceLabel}
                    />
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600">
                      Họ tên
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600">
                      CCCD
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600">
                      Vụ án
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600">
                      Trạng thái
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600">
                      Ngày tạo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      data-testid={`subject-row-${r.id}`}
                      className={
                        selection.isSelected(r.id) ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }
                    >
                      <BulkSelectionRowCell
                        id={r.id}
                        selection={selection}
                        rowLabel={`${cfg.resourceLabel} ${r.fullName}`}
                      />
                      <td className="px-3 py-2 text-sm font-medium text-slate-800">
                        {r.fullName}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-600">
                        {r.idNumber ?? '—'}
                      </td>
                      {/* Codex P2 (from PR4): case.name (not caseCode) */}
                      <td className="px-3 py-2 text-sm text-blue-700">
                        {r.case?.name ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                          {SUBJECT_STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {formatVNDate(r.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
