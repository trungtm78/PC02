/** Định dạng giá trị ô Excel — dùng chung cho mọi bảng khai cột xuất. */

/** Ngày theo giờ Việt Nam, dạng dd/mm/yyyy như trên màn. Không có ngày thì ô trống. */
export function ngayVN(d: Date | string | null | undefined): string {
  if (!d) return '';
  const ngay = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(ngay.getTime())) return '';
  return ngay.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Họ tên cán bộ như cột "Người nhập"/"Điều tra viên" trên màn: họ + tên, không có thì tên đăng nhập. */
export function hoTenCanBo(
  u:
    | {
        firstName?: string | null;
        lastName?: string | null;
        username?: string | null;
      }
    | null
    | undefined,
): string {
  if (!u) return '';
  const ten = `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim();
  return ten || (u.username ?? '');
}
