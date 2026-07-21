/**
 * useListPageUrlState — sync list page filter/page/search state với URL query params.
 *
 * Prefix-isolated để nhiều list page có thể coexist trên cùng route
 * (vd ComprehensiveListPage hiển thị Cases + Incidents + Petitions).
 *
 * Pattern: ?{prefix}_status=...&{prefix}_page=...&{prefix}_q=...
 *
 * Usage:
 *   const url = useListPageUrlState('cases');
 *   const status = url.getParam('status');           // 'TIEP_NHAN' | null
 *   const page = url.getNumberParam('page', 1);      // 1 if missing/invalid
 *   url.setParam('status', 'DANG_DIEU_TRA');         // single update
 *   url.setParams({ status: 'TIEP_NHAN', page: '1' }); // atomic batch update
 *   url.clearAll();                                  // remove all prefixed params
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * `history: 'push'` tạo một mục lịch sử để nút Back của trình duyệt quay lại được bộ lọc
 * trước. Mặc định vẫn là `'replace'` như cũ — gõ tìm kiếm hay đổi trang mà đẩy lịch sử
 * thì bấm Back sẽ phải bấm hàng chục lần mới thoát khỏi trang.
 *
 * Dùng `'push'` cho thao tác NGƯỜI DÙNG CHỦ Ý làm và mong quay lại được: bấm thẻ thống kê.
 */
export interface UrlWriteOptions {
  history?: 'push' | 'replace';
}

export interface ListPageUrlState {
  getParam(key: string): string | null;
  getNumberParam(key: string, defaultValue: number): number;
  setParam(key: string, value: string | null, options?: UrlWriteOptions): void;
  setParams(updates: Record<string, string | null>, options?: UrlWriteOptions): void;
  clearAll(): void;
}

export function useListPageUrlState(prefix: string): ListPageUrlState {
  const [searchParams, setSearchParams] = useSearchParams();
  const fullKey = useCallback((key: string) => `${prefix}_${key}`, [prefix]);

  const getParam = useCallback(
    (key: string): string | null => searchParams.get(fullKey(key)),
    [searchParams, fullKey],
  );

  const getNumberParam = useCallback(
    (key: string, defaultValue: number): number => {
      const raw = searchParams.get(fullKey(key));
      if (raw == null) return defaultValue;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : defaultValue;
    },
    [searchParams, fullKey],
  );

  const setParam = useCallback(
    (key: string, value: string | null, options?: UrlWriteOptions) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const k = fullKey(key);
          if (value == null || value === '') {
            next.delete(k);
          } else {
            next.set(k, value);
          }
          return next;
        },
        { replace: options?.history !== 'push' },
      );
    },
    [setSearchParams, fullKey],
  );

  const setParams = useCallback(
    (updates: Record<string, string | null>, options?: UrlWriteOptions) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            const k = fullKey(key);
            if (value == null || value === '') {
              next.delete(k);
            } else {
              next.set(k, value);
            }
          }
          return next;
        },
        { replace: options?.history !== 'push' },
      );
    },
    [setSearchParams, fullKey],
  );

  const clearAll = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const prefixDot = `${prefix}_`;
        // Snapshot keys vì delete iterate destructive trong URLSearchParams.
        const keysToDelete: string[] = [];
        next.forEach((_v, k) => {
          if (k.startsWith(prefixDot)) keysToDelete.push(k);
        });
        keysToDelete.forEach((k) => next.delete(k));
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams, prefix]);

  return { getParam, getNumberParam, setParam, setParams, clearAll };
}
