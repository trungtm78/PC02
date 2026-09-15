/**
 * Tham số `GET /admin/users` từ các ô lọc của màn Quản lý người dùng. Trạng thái đi bằng `status`
 * (`active` | `inactive`) — đúng khoá `QueryUsersDto` khai. Màn từng gửi `isActive`; ValidationPipe
 * toàn cục chặn khoá lạ (`forbidNonWhitelisted`) nên chọn lọc trạng thái là 400 cho cả danh sách.
 */
export function thamSoDanhSachNguoiDung(loc: {
  tuKhoa: string;
  vaiTro: string;
  trangThai: string;
}): Record<string, string> {
  const params: Record<string, string> = {};
  if (loc.tuKhoa) params.search = loc.tuKhoa;
  if (loc.vaiTro !== 'all') params.roleId = loc.vaiTro;
  if (loc.trangThai !== 'all') params.status = loc.trangThai;
  return params;
}
