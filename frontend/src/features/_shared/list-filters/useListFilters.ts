import { useCallback, useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ListFilterRegistry } from './registry';

/**
 * v0.62 PR1a — Filter state hook with URL round-trip.
 *
 * Pattern: draft + applied.
 *   - `draft`: in-memory state user is editing.
 *   - `applied`: state synced to URL (parent observes for refetch).
 *
 * apply() flushes draft → URL → applied. reset() clears both.
 *
 * Cả hai đều XOÁ `{prefix}_page` khỏi địa chỉ trang, tức đưa danh sách về trang 1. Khoá
 * trang CÓ TIỀN TỐ như mọi khoá khác của trang danh sách (`petitions_page`), nên xoá khoá
 * trống `page` là xoá một thứ không tồn tại. Không làm
 * vậy thì cán bộ đang ở trang 5 mà đặt thêm bộ lọc sẽ thấy BẢNG TRỐNG — kết quả mới
 * chỉ còn 2 trang. Bảng trống không giải thích gì, nên người dùng kết luận sai rằng
 * không còn hồ sơ nào. Ô tìm kiếm và chip trạng thái đã về trang 1 từ trước; đây là
 * chỗ duy nhất còn lệch.
 *
 * URL prefix isolates multiple filters on same route (e.g. Comprehensive).
 * Uses stable `searchParams` reference from react-router to avoid
 * useEffect infinite loops (early v0.62 bug).
 */

interface UseListFiltersArgs<TValue extends object> {
  prefix: string;
  registry: ListFilterRegistry<TValue>;
}

export interface UseListFiltersResult<TValue> {
  draft: TValue;
  applied: TValue;
  setField: <K extends keyof TValue & string>(key: K, value: string) => void;
  apply: () => void;
  reset: () => void;
  hasUnappliedChanges: boolean;
}

export function useListFilters<TValue extends object>({
  prefix,
  registry,
}: UseListFiltersArgs<TValue>): UseListFiltersResult<TValue> {
  const [searchParams, setSearchParams] = useSearchParams();

  const applied = useMemo(() => {
    const value = {} as Record<string, string>;
    for (const field of registry.all()) {
      const raw = searchParams.get(`${prefix}_${field.urlKey}`);
      if (raw != null && raw !== '') value[field.key] = raw;
    }
    return value as TValue;
  }, [searchParams, registry, prefix]);

  const [draft, setDraft] = useState<TValue>(applied);

  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  const setField = useCallback(
    <K extends keyof TValue & string>(key: K, value: string) => {
      setDraft((prev) => ({ ...prev, [key]: value }) as TValue);
    },
    [],
  );

  const apply = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const field of registry.all()) {
          const value = (draft as Record<string, string | undefined>)[field.key];
          const k = `${prefix}_${field.urlKey}`;
          if (value && value !== '') next.set(k, value);
          else next.delete(k);
        }
        next.delete(`${prefix}_page`);
        return next;
      },
      { replace: true },
    );
  }, [draft, registry, prefix, setSearchParams]);

  const reset = useCallback(() => {
    setDraft({} as TValue);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const field of registry.all()) {
          next.delete(`${prefix}_${field.urlKey}`);
        }
        next.delete(`${prefix}_page`);
        return next;
      },
      { replace: true },
    );
  }, [registry, prefix, setSearchParams]);

  const hasUnappliedChanges = useMemo(() => {
    for (const field of registry.all()) {
      const a = (applied as Record<string, string | undefined>)[field.key];
      const d = (draft as Record<string, string | undefined>)[field.key];
      if ((a ?? '') !== (d ?? '')) return true;
    }
    return false;
  }, [registry, applied, draft]);

  return { draft, applied, setField, apply, reset, hasUnappliedChanges };
}
