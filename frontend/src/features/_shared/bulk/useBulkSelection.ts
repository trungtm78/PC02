import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

/**
 * v0.48 PR1 F1 — Bulk selection hook.
 *
 * Modes:
 * - 'page': default. Toggle/select-all áp dụng cho `pageRows` hiện tại.
 * - 'all-matching-filter': opt-in via `selectAllMatchingFilter()`. Hook fetch
 *   tất cả id khớp filter qua `fetchAllIdsMatchingFilter` callback.
 *
 * Auto-clear: khi `pageRows` ids đổi (filter/sort/page-size change), hook reset
 * selection để tránh stale ids (plan eng frontend: clear-on-filter-change).
 *
 * Plan v2 design F5 (revised): 'all-matching-filter' mode chỉ enable cho bulk-export
 * action ở adapter layer. Hook không enforce ở đây — caller responsibility.
 */
export type BulkSelectionMode = 'page' | 'all-matching-filter';
export type BulkSelectionPageState = 'none' | 'some' | 'all';

export interface UseBulkSelectionOptions<TRow> {
  rowKey: keyof TRow;
  pageRows: TRow[];
  /** Total bản ghi khớp filter hiện tại (để hiển thị banner "select all matching"). */
  totalCountMatchingFilter?: number;
  /** Async fetch tất cả id khớp filter. Required nếu user gọi `selectAllMatchingFilter`. */
  fetchAllIdsMatchingFilter?: () => Promise<string[]>;
}

export interface UseBulkSelectionResult {
  selectedIds: Set<string>;
  mode: BulkSelectionMode;
  count: number;
  /** Header checkbox 3-state: none (unchecked), some (indeterminate), all (checked). */
  pageState: BulkSelectionPageState;
  isSelected: (id: string) => boolean;
  toggleOne: (id: string) => void;
  /** Toggle: nếu pageState='all' → deselect page; else select all page rows. */
  togglePage: () => void;
  /** Fetch + select tất cả ids khớp filter. Set mode='all-matching-filter'. */
  selectAllMatchingFilter: () => Promise<void>;
  clear: () => void;
}

export function useBulkSelection<TRow>(
  opts: UseBulkSelectionOptions<TRow>,
): UseBulkSelectionResult {
  const { rowKey, pageRows } = opts;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<BulkSelectionMode>('page');

  // Auto-clear khi pageRows id-set thay đổi (filter/sort/page change).
  // Tránh stale selection chứa id không còn trong page hiện tại.
  const pageRowIdsRef = useRef<string>('');
  const currentPageIds = useMemo(
    () => pageRows.map((r) => String(r[rowKey])).sort().join('|'),
    [pageRows, rowKey],
  );

  useEffect(() => {
    // Skip first render (ref empty → initial).
    if (pageRowIdsRef.current !== '' && pageRowIdsRef.current !== currentPageIds) {
      setSelectedIds(new Set());
      setMode('page');
    }
    pageRowIdsRef.current = currentPageIds;
  }, [currentPageIds]);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // Toggling 1 row → revert to page mode (all-matching-filter là 1 atomic action).
    setMode('page');
  }, []);

  const pageIds = useMemo(
    () => pageRows.map((r) => String(r[rowKey])),
    [pageRows, rowKey],
  );

  const pageState: BulkSelectionPageState = useMemo(() => {
    if (pageIds.length === 0) return 'none';
    let selectedOnPage = 0;
    for (const id of pageIds) {
      if (selectedIds.has(id)) selectedOnPage++;
    }
    if (selectedOnPage === 0) return 'none';
    if (selectedOnPage === pageIds.length) return 'all';
    return 'some';
  }, [pageIds, selectedIds]);

  const togglePage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = pageIds.every((id) => next.has(id));
      if (allSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
    setMode('page');
  }, [pageIds]);

  const selectAllMatchingFilter = useCallback(async () => {
    if (!opts.fetchAllIdsMatchingFilter) {
      throw new Error('fetchAllIdsMatchingFilter required for all-matching-filter mode');
    }
    const allIds = await opts.fetchAllIdsMatchingFilter();
    setSelectedIds(new Set(allIds));
    setMode('all-matching-filter');
  }, [opts.fetchAllIdsMatchingFilter]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    setMode('page');
  }, []);

  return {
    selectedIds,
    mode,
    count: selectedIds.size,
    pageState,
    isSelected,
    toggleOne,
    togglePage,
    selectAllMatchingFilter,
    clear,
  };
}
