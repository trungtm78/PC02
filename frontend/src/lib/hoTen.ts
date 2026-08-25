/**
 * Ghép họ tên người dùng theo thứ tự TIẾNG VIỆT: HỌ trước, TÊN sau.
 *
 * Cơ sở dữ liệu lưu theo quy ước tiếng Anh — `lastName` là họ và tên đệm, `firstName` là tên
 * gọi. Đo trên bản chạy thật 25/08/2026:
 *
 *     lastName = "Phường An Hội"   firstName = "Tây"     → "Phường An Hội Tây"
 *     lastName = "Hà Minh"         firstName = "Trung"   → "Hà Minh Trung"
 *
 * Ghép `[firstName, lastName]` như mã cũ cho ra "Tây Phường An Hội" — người Việt đọc ra một
 * cái tên khác hẳn, không phải cùng một người viết ngược. 256/257 tài khoản có cả hai trường,
 * nên lỗi ấy chạm gần như mọi cán bộ ở mọi màn hình, kể cả tên in trên mẫu Word.
 *
 * Đây là NƠI DUY NHẤT quyết định thứ tự ấy. Trước bản vá này, cùng một phép ghép bị chép tay
 * ở 19 chỗ — sửa một chỗ thì 18 chỗ kia vẫn sai và không có gì báo.
 */
export interface NguoiDungCoTen {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}

/**
 * @param u người dùng, có thể null
 * @param duPhong giá trị khi không có tên nào (mặc định: username, rồi chuỗi rỗng)
 */
export function hoTen(u: NguoiDungCoTen | null | undefined, duPhong?: string): string {
  if (!u) return duPhong ?? '';
  // HỌ trước, TÊN sau. `filter(Boolean)` bỏ phần thiếu thay vì để lại khoảng trắng thừa —
  // tài khoản chỉ có họ hoặc chỉ có tên vẫn ra chuỗi sạch.
  const ten = [u.lastName, u.firstName].filter(Boolean).join(' ').trim();
  return ten || duPhong || u.username || '';
}

/** Họ tên kèm cấp bậc phía trước, dùng cho chứng từ: "Thiếu tá Phường An Hội Tây". */
export function hoTenCoCapBac(
  u: (NguoiDungCoTen & { rank?: string | null }) | null | undefined,
): string {
  if (!u) return '';
  return [u.rank, hoTen(u)].filter(Boolean).join(' ').trim();
}
