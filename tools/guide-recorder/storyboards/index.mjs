/**
 * Registry storyboard — thứ tự theo trình tự trưởng thành của dữ liệu.
 * Thêm clip mới: import + đẩy vào mảng BOARDS (giữ đúng thứ tự slug NN-).
 */
import dangNhap from './01-dang-nhap.mjs';

export const BOARDS = [
  dangNhap,
];

export function findBoard(slug) {
  return BOARDS.find((b) => b.slug === slug || b.slug.startsWith(slug));
}
