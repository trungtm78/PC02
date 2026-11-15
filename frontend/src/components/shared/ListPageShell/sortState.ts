/**
 * Trạng thái sắp xếp của danh sách, và luật khi người dùng bấm tiêu đề cột.
 *
 * Tách khỏi component để kiểm được trực tiếp — luật ba nhịp (giảm → tăng → mặc định)
 * là thứ dễ sai và dễ hồi quy nhất, không nên chôn trong JSX.
 */

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  /** Trường đang sắp. `undefined` nghĩa là dùng mặc định của máy chủ. */
  sortBy?: string;
  sortOrder: SortDirection;
}

/**
 * Luật ba nhịp khi bấm cùng một cột: **giảm dần → tăng dần → về mặc định**.
 *
 * Bắt đầu bằng GIẢM DẦN vì với hồ sơ nghiệp vụ, cái mới gần như luôn là cái cần xử lý
 * trước. Nhịp thứ ba trả về mặc định để người dùng luôn có đường quay lại, không bị kẹt
 * trong một thứ tự tự chọn mà không biết cách thoát.
 *
 * `first`: the direction of the first beat. A column whose natural reading is ascending (an alert, most urgent first)
 * starts at `asc`; the second beat is then the opposite and the third is still the default.
 */
export function resolveNextSort(current: SortState, clickedKey: string, first: SortDirection = 'desc'): SortState {
  if (current.sortBy !== clickedKey) {
    return { sortBy: clickedKey, sortOrder: first };
  }
  if (current.sortOrder === first) {
    return { sortBy: clickedKey, sortOrder: first === 'desc' ? 'asc' : 'desc' };
  }
  return { sortBy: undefined, sortOrder: 'desc' };
}
