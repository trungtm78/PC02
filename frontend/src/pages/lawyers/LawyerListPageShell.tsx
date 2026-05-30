/**
 * LawyerListPageShell — PR4 ListPageShell consumer cho Luật sư + bulk-delete v0.51.
 *
 * Mirrors PR2 shell pattern (alongside legacy LawyerListPage):
 * - useListPageUrlState('lawyers') — q + page + sortBy + sortOrder
 * - GET /api/v1/lawyers list
 * - Bulk-delete via BulkActionBar + useBulkSelection + BulkSelectionColumn (v0.51 infra)
 * - 300ms search debounce + AbortController cancellation
 * - Table state machine (loading/error/empty/empty-filtered/ready)
 * - Vietnamese error map
 *
 * Bulk integration (PR4 plan key deliverable):
 * - BulkSelectionHeaderCell + BulkSelectionRowCell (sticky-left columns)
 * - useBulkSelection clears on filter/sort/page change (built-in)
 * - BulkActionBar sticky-bottom với escalating friction (10/50/200)
 * - Adapter via buildLawyersAdapter({ enableDelete: true })
 * - Permission: 'lawyers' resource 'delete' action (server enforces creator-or-admin)
 *
 * KHÔNG thay thế production LawyerListPage — feature-flag swap in follow-up.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Scale, AlertCircle, X } from 'lucide-react';
import { api } from '@/lib/api';
import {
  ListPageShell,
  useListPageUrlState,
  type TableState,
} from '@/components/shared/ListPageShell';
import { useBulkSelection } from '@/features/_shared/bulk/useBulkSelection';
import {
  BulkSelectionHeaderCell,
  BulkSelectionRowCell,
} from '@/features/_shared/bulk/BulkSelectionColumn';
import { BulkActionBar } from '@/features/_shared/bulk/BulkActionBar';
import { buildLawyersAdapter } from '@/features/_shared/bulk/adapters/lawyers';
import type { BulkAction, BulkResult } from '@/features/_shared/bulk/types';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { formatVNDate } from '@/lib/dates';

interface Lawyer {
  id: string;
  fullName: string;
  lawFirm?: string;
  barNumber: string;
  phone?: string;
  caseId: string;
  subjectId?: string | null;
  createdAt: string;
  case?: { id: string; name: string; status?: string };
  subject?: { id: string; fullName: string };
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
    return 'Không tải được danh sách luật sư';
  }
  return 'Lỗi không xác định';
}

function sanitizeStringParam(v: string | null, maxLen = 200): string {
  if (v == null) return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\x00-\x1f\x7f]/g, '').slice(0, maxLen);
}

const PAGE_SIZE = 20;

export function LawyerListPageShell() {
  const url = useListPageUrlState('lawyers');

  const page = Math.max(1, url.getNumberParam('page', 1));
  const searchQuery = sanitizeStringParam(url.getParam('q'));

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [rows, setRows] = useState<Lawyer[]>([]);
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
    params.set('offset', String((page - 1) * PAGE_SIZE));
    params.set('limit', String(PAGE_SIZE));
    if (debouncedSearch) params.set('search', debouncedSearch);

    api
      .get<{ data: Lawyer[]; total: number }>(`/lawyers?${params.toString()}`, {
        signal: ctrl.signal,
      })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        const data = res.data?.data ?? [];
        const total = res.data?.total ?? 0;
        setRows(data);
        setTotalCount(total);
        if (total === 0) {
          setTableState(debouncedSearch ? 'empty-filtered' : 'empty');
        } else {
          setTableState('ready');
        }
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || axios.isCancel(e)) return;
        setError(getVietnameseErrorMessage(e));
        setTableState('error');
      });
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchList();
    return () => abortRef.current?.abort();
  }, [fetchList]);

  // PR3 page-clamp pattern: if user is past last page (delete/filter scenario), reset.
  useEffect(() => {
    if (totalCount === 0) return;
    const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (page > maxPage) url.setParam('page', '1');
  }, [totalCount, page, url]);

  const selection = useBulkSelection<Lawyer>({
    rowKey: 'id',
    pageRows: rows,
    totalCountMatchingFilter: totalCount,
  });

  // Codex P2 fix — stale selection race: when user changes page or search,
  // there's a window (300ms debounce + fetch RTT) where `rows` still contains
  // the previous page's data but URL state has advanced. Bulk action would
  // submit IDs from the WRONG context. Clear selection synchronously at the
  // URL-change boundary to enforce the intended clear-on-filter/page-change
  // safety guarantee.
  const selectionClearRef = useRef(selection.clear);
  selectionClearRef.current = selection.clear;
  useEffect(() => {
    selectionClearRef.current();
  }, [page, searchQuery]);

  const adapter = useMemo(() => buildLawyersAdapter({ enableDelete: true }), []);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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

  const activeFilterCount = searchQuery ? 1 : 0;

  const handleBulkSuccess = useCallback(
    (result: BulkResult | void, action: BulkAction<Lawyer>) => {
      if (action.key === 'delete' && result && typeof result === 'object') {
        const { succeeded, skipped, failed } = result;
        const parts: string[] = [];
        if (succeeded?.length) parts.push(`Đã xóa ${succeeded.length} luật sư`);
        if (skipped?.length) parts.push(`Bỏ qua ${skipped.length} (không đủ quyền/đã xóa)`);
        if (failed?.length) parts.push(`Lỗi ${failed.length}`);
        setTransientBanner({
          kind: failed?.length ? 'error' : 'success',
          text: parts.join(' · ') || 'Hoàn tất xóa hàng loạt',
        });
        fetchList(); // Refetch to reflect deletions
      }
    },
    [fetchList],
  );

  const handleBulkError = useCallback(
    (err: unknown, action: BulkAction<Lawyer>) => {
      setTransientBanner({
        kind: 'error',
        text: `Thao tác "${action.label}" thất bại: ${getVietnameseErrorMessage(err)}`,
      });
    },
    [],
  );

  // Auto-dismiss transient banner after 5s
  useEffect(() => {
    if (!transientBanner) return;
    const t = setTimeout(() => setTransientBanner(null), 5000);
    return () => clearTimeout(t);
  }, [transientBanner]);

  return (
    <>
      <ListPageShell>
        <ListPageShell.Header
          icon={Scale}
          title="Danh sách luật sư"
          subtitle="Luật sư bào chữa theo vụ án / bị can (BLTTHS 2015 Đ.72)"
        />
        <ListPageShell.Toolbar
          searchValue={searchQuery}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Tìm theo họ tên, số thẻ luật sư, văn phòng..."
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
        />

        {/* Transient banner — success/error after bulk action.
            Positioned BEFORE table for visibility. */}
        {transientBanner && (
          <div
            data-testid="lawyers-bulk-banner"
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

        {/* Custom table — list pages PC02 KHÔNG dùng shared DataTable
            (memory + BulkSelectionColumn comment). Inline rendering với
            sticky-left checkbox columns from BulkSelectionColumn helpers. */}
        <div className="px-4 py-3" data-testid="lawyers-shell-table-wrap">
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
              <p className="text-slate-700 font-medium">Chưa có luật sư nào</p>
              <p className="text-sm text-slate-500 mt-1">
                Thêm luật sư qua màn hình vụ án.
              </p>
            </div>
          )}
          {tableState === 'empty-filtered' && (
            <div
              data-testid="list-page-shell-table-empty-filtered"
              className="bg-white border border-slate-200 rounded-lg p-12 text-center"
            >
              <p className="text-slate-700 font-medium">Không có luật sư phù hợp</p>
              <p className="text-sm text-slate-500 mt-1">Thử xóa bộ lọc.</p>
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
              <table className="w-full text-sm" data-testid="lawyers-shell-table">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <BulkSelectionHeaderCell selection={selection} totalRowsLabel="luật sư" />
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600">
                      Họ tên
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600">
                      Số thẻ
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600">
                      Văn phòng
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600">
                      Vụ án
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600">
                      Bị can / Thân chủ
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600">
                      SĐT
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
                      data-testid={`lawyer-row-${r.id}`}
                      className={selection.isSelected(r.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}
                    >
                      <BulkSelectionRowCell
                        id={r.id}
                        selection={selection}
                        rowLabel={`luật sư ${r.fullName}`}
                      />
                      <td className="px-3 py-2 text-sm font-medium text-slate-800">
                        {r.fullName}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-600">
                        {r.barNumber}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{r.lawFirm ?? '—'}</td>
                      {/* Codex P2 fix: lawyers API returns case.{id,name,status} —
                          NOT caseCode. Use name for display. */}
                      <td className="px-3 py-2 text-sm text-blue-700">
                        {r.case?.name ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">
                        {r.subject?.fullName ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-600">{r.phone ?? '—'}</td>
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

      {/* BulkActionBar — sticky bottom, only renders when selection.count > 0.
          Pass adapter + selection + pageRows. onSuccess/onError dispatch banner + refetch. */}
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

export default LawyerListPageShell;
