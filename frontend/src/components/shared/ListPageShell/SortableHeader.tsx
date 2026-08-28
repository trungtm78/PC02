import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { TABLE_HEADER_CELL } from '@/constants/styles';
import type { SortState } from './sortState';
import { TayNamKeo } from './TayNamKeo';

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
  keoGian,
}: {
  label: string;
  sortKey?: string;
  sort: Pick<SortState, 'sortBy' | 'sortOrder'>;
  onSort: (key: string) => void;
  width?: string;
  className?: string;
  /**
   * Bật tay nắm kéo giãn cho cột này. Không truyền = giữ nguyên ô tiêu đề như cũ, nên bảng nào
   * chưa nối vào bố cục người dùng không đổi một chút nào.
   */
  keoGian?: {
    tenCot: string;
    beRongHienTai: number;
    onXong: (px: number) => void;
    onVeMacDinh?: () => void;
  };
}) {
  const style = width ? { width } : undefined;
  // Tay nắm cần một gốc toạ độ. `relative` cho ô thường — NHƯNG KHÔNG cho ô ghim: `relative`
  // và `sticky` cùng là thuộc tính `position`, thêm `relative` vào ô ghim là ĐÈ MẤT `sticky`
  // và cột Thao tác trôi đi ngay khi cuộn ngang.
  //
  // Ô ghim không cần thêm gì: `position: sticky` tự nó đã là phần tử được định vị, nên con
  // tuyệt đối bên trong neo đúng vào nó.
  const daCoGocToaDo = (className ?? '').includes('sticky');
  const cellClass = `${className ?? TABLE_HEADER_CELL}${
    keoGian && !daCoGocToaDo ? ' relative' : ''
  }`;
  const nam = keoGian ? (
    <TayNamKeo
      tenCot={keoGian.tenCot}
      nhanCot={label}
      beRongHienTai={keoGian.beRongHienTai}
      onXong={keoGian.onXong}
      onVeMacDinh={keoGian.onVeMacDinh}
    />
  ) : null;

  // Tay nắm mang `aria-label` riêng, mà thuật toán tính tên của `<th>` gộp cả nhãn của con —
  // để nguyên thì trình đọc màn hình đọc "Thao tác Kéo giãn cột Thao tác" ở MỌI cột. Khai tên
  // tường minh cho ô thì thuật toán bỏ qua nội dung con, và tay nắm vẫn có nhãn riêng của nó.
  const tenO = nam ? { 'aria-label': label } : {};

  if (!sortKey) {
    return (
      <th scope="col" style={style} className={cellClass} {...tenO}>
        {label}
        {nam}
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
    <th scope="col" style={style} className={cellClass} aria-sort={ariaSort} {...tenO}>
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
      {nam}
    </th>
  );
}
