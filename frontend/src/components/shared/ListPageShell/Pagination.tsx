/**
 * <ListPageShell.Pagination> — page numbers + prev/next.
 *
 * Không render khi totalPages <= 1 (Codex review finding: redundant UI).
 * aria-controls reference Context tableId cho a11y.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGINATION_BAR, PAGINATION_BUTTON, A11Y_FOCUS_RING } from '@/constants/styles';
import { useListPageShellContext } from './ListPageShell';

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange(page: number): void;
  /** Optional page size cho info display. */
  pageSize?: number;
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  onPageChange,
}: PaginationProps) {
  const { tableId } = useListPageShellContext();
  if (totalPages <= 1) return null;

  return (
    <nav
      data-testid="list-page-shell-pagination"
      aria-label="Phân trang danh sách"
      aria-controls={tableId}
      className={PAGINATION_BAR}
    >
      <span className="tabular-nums">
        Tổng cộng <strong>{totalCount.toLocaleString('vi-VN')}</strong> bản ghi
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={`${PAGINATION_BUTTON} ${A11Y_FOCUS_RING}`}
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span>Trước</span>
        </button>
        <span
          data-testid="list-page-shell-pagination-current"
          className="text-sm tabular-nums px-2"
        >
          Trang <strong>{page}</strong> / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={`${PAGINATION_BUTTON} ${A11Y_FOCUS_RING}`}
        >
          <span>Sau</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
