import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của màn Nhật ký hoạt động (`ActivityLogPage.tsx`) — bảng `audit_logs` (13.218
 * dòng, ~1.457/tuần prod 15/09/2026; trigger cột bóng trên mỗi lượt ghi là rẻ).
 *
 * Thứ tự = thứ tự cột: Thời gian, Người thực hiện, Thao tác, Đối tượng tác động (loại + mã), IP.
 * "Người thực hiện" lọc ở MÁY CHỦ qua `users.ho_ten_bd` — trước đây màn lọc lại trên trang đã tải nên
 * tên người dùng không bao giờ ra. Thao tác và loại đối tượng là MÃ (CASE_CREATED, Case) nên so đúng
 * mã, không phân biệt hoa thường.
 */
export const KHAI_TIM_KIEM_NHAT_KY: KhaiThucThe = {
  thucThe: 'nhat-ky',
  bang: 'audit_logs',
  model: 'AuditLog',
  // Thẻ "*" tìm cả tên người thực hiện: bảng không có cột chữ nào chứa tên (thao tác/đối tượng/IP
  // đều là mã) mà ô tìm cũ hứa "tìm theo người thực hiện". 13k dòng — OR qua users không đáng kể.
  tatCaGomNguoi: true,
  truong: [
    { key: 'thoiGian', nhan: 'Thời gian', kieu: 'ngay', cot: 'createdAt' },
    {
      key: 'nguoiThucHien',
      nhan: 'Người thực hiện',
      kieu: 'nguoi',
      quanHe: 'user',
    },
    { key: 'thaoTac', nhan: 'Thao tác', kieu: 'ma-thuong', cot: 'action' },
    {
      key: 'loaiDoiTuong',
      nhan: 'Loại đối tượng',
      kieu: 'ma-thuong',
      cot: 'subject',
    },
    {
      key: 'maDoiTuong',
      nhan: 'Mã đối tượng',
      kieu: 'ma-thuong',
      cot: 'subjectId',
    },
    { key: 'ip', nhan: 'IP', kieu: 'ma-thuong', cot: 'ipAddress' },
  ],
};
