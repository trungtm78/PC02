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
  ColumnPicker,
  useBoCucCot,
  type ColumnDef,
  useListPageUrlState,
  type TableState,
  getVietnameseErrorMessage,
  sanitizeStringParam,
  LIST_PAGE_SIZE,
} from '@/components/shared/ListPageShell';
import { useBulkSelection } from '@/features/_shared/bulk/useBulkSelection';
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

const PAGE_SIZE = LIST_PAGE_SIZE;

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
        setError(getVietnameseErrorMessage(e, 'luật sư'));
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

  const adapter = useMemo(
    () => buildLawyersAdapter({ enableDelete: true, enableExport: true }),
    [],
  );

  /**
   * Cột bảng Luật sư — chuyển từ `<table>` tự dựng sang `ListPageShell.Table`, để màn này
   * cũng kéo giãn / ẩn hiện / đổi thứ tự cột được như ba màn chính.
   */
  const columns: ColumnDef<Lawyer>[] = useMemo(
    () => [
      { key: 'fullName', header: 'Họ tên', width: '14rem', optional: 'show',
        cellClassName: 'px-3 py-2 text-sm font-medium text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.fullName },
      { key: 'barNumber', header: 'Số thẻ', width: '9rem', optional: 'show',
        cellClassName: 'px-3 py-2 text-xs font-mono text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.barNumber },
      { key: 'lawFirm', header: 'Văn phòng', width: '14rem', optional: 'show',
        cellClassName: 'px-3 py-2 text-sm text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.lawFirm ?? '—' },
      // API luật sư trả `case.{id,name,status}` — KHÔNG có `caseCode`. Codex đã sửa ở PR4.
      { key: 'case', header: 'Vụ án', width: '18rem', optional: 'show',
        cellClassName: 'px-3 py-2 text-sm text-blue-700 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.case?.name ?? '—' },
      { key: 'subject', header: 'Bị can / Thân chủ', width: '13rem', optional: 'show',
        cellClassName: 'px-3 py-2 text-sm text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.subject?.fullName ?? '—' },
      { key: 'phone', header: 'SĐT', width: '9rem', optional: 'show',
        cellClassName: 'px-3 py-2 text-sm text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.phone ?? '—' },
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
  } = useBoCucCot('lawyers', columns);

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
        text: `Thao tác "${action.label}" thất bại: ${getVietnameseErrorMessage(err, 'luật sư')}`,
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

        <ListPageShell.Table<Lawyer>
          state={tableState}
          fixedLayout
          onKeoGian={datBeRong}
          onVeMacDinhCot={xoaBeRong}
          datTongBeRong={coGhiDeBeRong}
          columns={visibleColumns}
          data={rows}
          rowKey={(r) => r.id}
          title="Luật sư"
          totalCount={totalCount}
          error={error}
          bulkSelection={selection}
          bulkRowsLabel="luật sư"
          // Giữ NGUYÊN nhãn cũ của ô tick — đây là thứ trình đọc màn hình đọc lên.
          bulkRowLabel={(r) => `luật sư ${r.fullName}`}
          emptyState={{
            title: 'Chưa có luật sư nào',
            description: 'Thêm luật sư qua màn hình vụ án.',
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
