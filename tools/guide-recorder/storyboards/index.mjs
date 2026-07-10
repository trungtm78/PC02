/**
 * Registry storyboard — thứ tự theo trình tự trưởng thành của dữ liệu.
 * Thêm clip mới: import + đẩy vào mảng BOARDS (giữ đúng thứ tự slug NN-).
 */
import dangNhap from './01-dang-nhap.mjs';
import tongQuan from './02-tong-quan.mjs';
import tiepNhanDonThu from './03-tiep-nhan-don-thu.mjs';
import baoCaoKpi from './15-bao-cao-kpi.mjs';

export const BOARDS = [
  dangNhap,
  tongQuan,
  tiepNhanDonThu,
  baoCaoKpi,
];

export function findBoard(slug) {
  return BOARDS.find((b) => b.slug === slug || b.slug.startsWith(slug));
}
