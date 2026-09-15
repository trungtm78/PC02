import { BadRequestException } from '@nestjs/common';
import { KHOA_TAT_CA } from './dieu-kien';
import type { KhaiThucThe } from './sinh/sinh-tim-kiem';

/**
 * Khoá thẻ dùng được trên MỌI khai — cho màn gộp nhiều loại hồ sơ vào một danh sách (Hồ sơ trễ hạn).
 * Chung = khai nào cũng có và cùng kiểu. Bỏ kiểu `chon`: giá trị mỗi khai một bộ (ba enum trạng thái
 * khác nhau), một mã đúng ở bảng này là 400 ở bảng kia. Thứ tự theo khai đầu tiên.
 */
export function khoaChung(khais: readonly KhaiThucThe[]): string[] {
  const [dau, ...conLai] = khais;
  if (!dau) return [];
  return dau.truong
    .filter(
      (t) =>
        t.kieu !== 'chon' &&
        conLai.every((k) =>
          k.truong.some((u) => u.key === t.key && u.kieu === t.kieu),
        ),
    )
    .map((t) => t.key);
}

/**
 * Chặn thẻ không dùng được trên mọi khai TRƯỚC khi hỏi CSDL: để lọt xuống thì bảng có khoá lọc còn
 * bảng không có khoá ném 400 giữa chừng — hoặc tệ hơn, bị bỏ qua và trả dữ liệu chưa lọc. Sai dạng
 * (`khoá~giá trị`) để `docThe` của từng khai báo.
 */
export function kiemTheChung(
  tk: string | readonly string[] | undefined,
  khais: readonly KhaiThucThe[],
): void {
  const ds = tk === undefined ? [] : typeof tk === 'string' ? [tk] : tk;
  if (!ds.length) return;
  const chung = new Set(khoaChung(khais));
  for (const tho of ds) {
    const i = tho.indexOf('~');
    if (i <= 0) continue;
    const key = tho.slice(0, i);
    if (key !== KHOA_TAT_CA && !chung.has(key)) {
      throw new BadRequestException(
        `Cột "${key}" không tìm được trên mọi loại hồ sơ của danh sách này`,
      );
    }
  }
}
