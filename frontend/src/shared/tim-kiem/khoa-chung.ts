/** Đủ để so hai trường của hai khai: khoá + kiểu. */
interface TruongCoKhoa {
  readonly key: string;
  readonly kieu: string;
}

/**
 * Trường thẻ dùng được trên MỌI khai — gợi ý thẻ cho màn gộp nhiều loại hồ sơ (Hồ sơ trễ hạn: Đơn thư +
 * Vụ việc + Vụ án). Chung = khai nào cũng có khoá ấy và cùng kiểu; bỏ kiểu `chon` (mỗi khai một bộ giá
 * trị — ba enum trạng thái khác nhau). Trả trường của khai ĐẦU (nhãn, thứ tự).
 *
 * Cùng quy tắc với `backend/src/common/tim-kiem/khoa-chung.ts` (máy chủ chỉ nhận "*" và các khoá này);
 * hai phía ghim cùng một danh sách trong ca kiểm.
 */
export function khoaChung<T extends TruongCoKhoa>(
  khais: readonly [readonly T[], ...(readonly TruongCoKhoa[])[]],
): T[] {
  // Khai đầu giữ kiểu literal (nhãn/khoá chính xác cho ô thẻ); các khai sau chỉ cần khoá + kiểu để so.
  const [dau, ...conLai] = khais;
  return dau.filter(
    (t) =>
      t.kieu !== 'chon' &&
      conLai.every((k) => k.some((u) => u.key === t.key && u.kieu === t.kieu)),
  );
}
