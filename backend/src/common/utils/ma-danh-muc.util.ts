/**
 * Mã và thứ tự của mục danh mục tự sinh (`Directory`) — MỘT nơi cho mọi đường tạo mục: ô "Tạo mới"
 * trên form (`directory.service.ts`) và các CLI nạp dữ liệu cũ. Hai bản sinh mã ở hai nơi là hai
 * dãy mã trôi khỏi nhau trên cùng một loại danh mục.
 */

/** Mục chờ duyệt xếp sau mọi mục đã duyệt trong ô tìm. */
export const THU_TU_CHO_DUYET = 9000;

/**
 * Dãy mã kế tiếp = mã LỚN NHẤT đang có + 1, + 2, … — không phải số dòng + 1.
 *
 * Đếm dòng sai theo hai cách: sau khi xoá một dòng thì mã kế tiếp đụng mã đã tồn tại, và ràng
 * buộc `@@unique([type, code])` ném lỗi giữa chừng. Mã không theo mẫu tiền tố thì bỏ qua.
 */
export function sinhDayMa(
  daCo: readonly string[],
  soLuong: number,
  tienTo = 'DV',
): string[] {
  const mau = new RegExp(`^${tienTo}(\\d+)$`);
  let n = daCo.reduce((max, c) => {
    const m = mau.exec(c);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return Array.from(
    { length: soLuong },
    () => `${tienTo}${String(++n).padStart(4, '0')}`,
  );
}
