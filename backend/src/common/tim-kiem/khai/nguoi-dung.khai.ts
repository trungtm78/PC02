import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của màn Quản lý người dùng (`UserManagementPage.tsx`) — bảng `users`. Thứ tự =
 * thứ tự cột: Mã cán bộ, Họ tên, Email, Trạng thái, Đăng nhập cuối.
 *
 * "Họ tên" không có cột thật: ghép họ + tên + tài khoản (`cotGhep`) — ra ĐÚNG `users.ho_ten_bd` mà
 * thẻ kiểu người của mọi thực thể khác đã dùng, nên bộ sinh gộp làm một cột/trigger.
 *
 * Vai trò KHÔNG khai thẻ: danh sách vai trò động (bảng roles) và màn đã có ô chọn vai trò (`roleId`).
 */
export const KHAI_TIM_KIEM_NGUOI_DUNG: KhaiThucThe = {
  thucThe: 'nguoi-dung',
  bang: 'users',
  model: 'User',
  truong: [
    { key: 'maCanBo', nhan: 'Mã cán bộ', kieu: 'ma-thuong', cot: 'workId' },
    {
      key: 'hoTen',
      nhan: 'Họ tên',
      kieu: 'chu',
      cot: 'hoTen',
      cotGhep: ['lastName', 'firstName', 'username'],
    },
    { key: 'email', nhan: 'Email', kieu: 'chu', cot: 'email' },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'isActive',
      giaTriCot: { active: true, inactive: false },
    },
    {
      key: 'dangNhapCuoi',
      nhan: 'Đăng nhập cuối',
      kieu: 'ngay',
      cot: 'lastLoginAt',
    },
  ],
};
