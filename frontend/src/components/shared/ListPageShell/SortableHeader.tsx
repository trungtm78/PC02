import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { TABLE_HEADER_CELL } from '@/constants/styles';
import type { SortState } from './sortState';

/**
 * Ô tiêu đề cột. Cột nào khai `sortKey` thì bấm được để đổi thứ tự; cột không khai
 * (vd "Thao tác") giữ nguyên là tiêu đề trơn.
 *
 * `aria-sort` là bắt buộc, không phải trang trí: nếu không có nó, người dùng trình đọc
 * màn hình không biết bảng đang sắp theo cột nào và chiều nào.
 */
export function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  width,
  className,
}: {
  label: string;
  sortKey?: string;
  sort: Pick<SortState, 'sortBy' | 'sortOrder'>;
  onSort: (key: string) => void;
  width?: string;
  className?: string;
}) {
  const style = width ? { width } : undefined;
  const cellClass = className ?? TABLE_HEADER_CELL;

  if (!sortKey) {
    return (
      <th scope="col" style={style} className={cellClass}>
        {label}
      </th>
    );
  }

  const active = sort.sortBy === sortKey;
  const ariaSort = active
    ? sort.sortOrder === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  return (
    <th scope="col" style={style} className={cellClass} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-[#003973] transition-colors"
        data-testid={`sort-${sortKey}`}
      >
        {label}
        {/* Cột chưa sắp vẫn hiện mũi tên mờ — để cán bộ biết cột này bấm được. */}
        {!active && <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" aria-hidden="true" />}
        {active && sort.sortOrder === 'desc' && (
          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        {active && sort.sortOrder === 'asc' && (
          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}
