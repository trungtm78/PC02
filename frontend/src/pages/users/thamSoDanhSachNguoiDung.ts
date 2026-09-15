/**
 * Tham số `GET /admin/users` từ các ô lọc của màn Quản lý người dùng.
 *
 * - Trạng thái đi bằng `status` (`active` | `inactive`) — đúng khoá `QueryUsersDto` khai. Màn từng gửi
 *   `isActive`; ValidationPipe toàn cục chặn khoá lạ (`forbidNonWhitelisted`) nên chọn lọc trạng thái
 *   là 400 cho cả danh sách.
 * - Cờ `TIM_KIEM_THE` bật → gửi thẻ `tk` (máy chủ bỏ dấu, chọn cột), KHÔNG gửi `search`: `search` cũ
 *   cũng quy về thẻ "*" ở máy chủ, gửi kèm là lọc hai lần. Cờ tắt → ô chữ cũ như trước.
 */
export function thamSoDanhSachNguoiDung(loc: {
  tuKhoa: string;
  vaiTro: string;
  trangThai: string;
  theBat?: boolean;
  tk?: readonly string[];
}): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  if (loc.theBat) {
    if (loc.tk?.length) params.tk = [...loc.tk];
  } else if (loc.tuKhoa) {
    params.search = loc.tuKhoa;
  }
  if (loc.vaiTro !== 'all') params.roleId = loc.vaiTro;
  if (loc.trangThai !== 'all') params.status = loc.trangThai;
  return params;
}
