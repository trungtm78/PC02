/**
 * Registry storyboard — thứ tự theo trình tự trưởng thành của dữ liệu.
 * Thêm clip mới: import + đẩy vào mảng BOARDS (giữ đúng thứ tự slug NN-).
 */
import b01 from './01-dang-nhap.mjs';
import b02 from './02-tong-quan.mjs';
import b03 from './03-tiep-nhan-don-thu.mjs';
import b04 from './04-xu-ly-don-thu.mjs';
import b05 from './05-chuyen-vu-viec.mjs';
import b06 from './06-vu-viec-tiep-nhan.mjs';
import b07 from './07-vu-viec-trang-thai.mjs';
import b08 from './08-khoi-to-vu-an.mjs';
import b09 from './09-dieu-tra-vu-an.mjs';
import b10 from './10-ket-luan-truy-to.mjs';
import b11 from './11-uy-thac-trao-doi-vks.mjs';
import b12 from './12-in-chung-tu.mjs';
import b13 from './13-ho-so-journey.mjs';
import b14 from './14-thong-bao-nhac-han.mjs';
import b15 from './15-bao-cao-kpi.mjs';
import b16 from './16-tdc-phu-luc.mjs';
import b17 from './17-quan-tri-nguoi-dung.mjs';
import b18 from './18-quan-tri-he-thong.mjs';

export const BOARDS = [b01, b02, b03, b04, b05, b06, b07, b08, b09, b10, b11, b12, b13, b14, b15, b16, b17, b18];

export function findBoard(slug) {
  return BOARDS.find((b) => b.slug === slug || b.slug.startsWith(slug));
}
