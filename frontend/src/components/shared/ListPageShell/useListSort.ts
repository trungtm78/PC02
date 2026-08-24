import { useCallback } from 'react';
import { useListPageUrlState } from './useListPageUrlState';
import { resolveNextSort, type SortDirection, type SortState } from './sortState';

/**
 * Trạng thái sắp xếp của một danh sách, lưu trong ĐỊA CHỈ TRANG.
 *
 * Vì sao lưu vào địa chỉ chứ không phải state trong bộ nhớ: cán bộ F5 hoặc gửi đường dẫn
 * cho đồng nghiệp thì thứ tự phải giữ nguyên. Dùng lại `useListPageUrlState` sẵn có nên
 * nhiều danh sách trên cùng một trang (màn Tổng hợp) không giẫm lên nhau nhờ tiền tố.
 *
 * Dùng `history: 'replace'`: đổi thứ tự là thao tác tinh chỉnh, không nên nhồi lịch sử
 * trình duyệt khiến bấm Back hàng chục lần mới thoát được trang.
 */
export interface ListSort extends SortState {
  /** Bấm tiêu đề cột — theo luật ba nhịp: giảm → tăng → về mặc định. */
  onSort(key: string): void;
  /** Tham số gửi lên máy chủ. Rỗng khi đang dùng mặc định của máy chủ. */
  params: { sortBy?: string; sortOrder?: SortDirection };
}

export function useListSort(prefix: string): ListSort {
  const url = useListPageUrlState(prefix);

  const sortBy = url.getParam('sort') ?? undefined;
  const sortOrder: SortDirection = url.getParam('dir') === 'asc' ? 'asc' : 'desc';

  const onSort = useCallback(
    (key: string) => {
      const next = resolveNextSort({ sortBy, sortOrder }, key);
      url.setParams(
        {
          sort: next.sortBy ?? null,
          dir: next.sortBy ? next.sortOrder : null,
          // Đổi thứ tự thì trang hiện tại vô nghĩa — quay về trang đầu, nếu không cán
          // bộ đang ở trang 7 sẽ thấy một khúc giữa ngẫu nhiên của thứ tự mới.
          page: null,
        },
        { history: 'replace' },
      );
    },
    [sortBy, sortOrder, url],
  );

  return {
    sortBy,
    sortOrder,
    onSort,
    // Không gửi tham số khi chưa chọn gì → máy chủ dùng mặc định của từng module.
    params: sortBy ? { sortBy, sortOrder } : {},
  };
}
