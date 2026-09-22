/**
 * Mã loại tài liệu của khu "Tệp nhận từ đơn vị xử lý".
 *
 * Khai MỘT chỗ vì ba nơi phải nói cùng một mã: khu tải tệp trên form, bộ đếm số tệp trên cột
 * danh sách, và popup nhập nhanh. Ba nơi chép tay ba lần thì lệch một lần là bộ đếm nói một
 * đằng khu tệp hiện một nẻo — không ai thấy cho tới lúc cán bộ hỏi "sao báo 2 tệp mà mở ra
 * chỉ có 1".
 *
 * Giá trị phải KHỚP `backend/prisma/seed-directory-types.ts` (`DOCUMENT_TYPE`), cổng
 * `loaiTepKetQuaKhopSeed.gate.test.ts` canh.
 */
export const LOAI_TEP_KET_QUA = 'KET_QUA_DON_VI_XU_LY';
