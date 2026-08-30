import type { Ky } from './ky-bao-cao';

/** Giao của một ô biểu đồ với kỳ đang chọn. `null` khi không giao nhau. */
export function giaoVoiKy(dau: Date, cuoi: Date, ky: Ky): { tu: Date; den: Date } | null {
  const tu = dau > ky.tu ? dau : ky.tu;
  const den = cuoi < ky.den ? cuoi : ky.den;
  return tu <= den ? { tu, den } : null;
}

export interface OBieuDo {
  nam: number;
  so: number;
  tu: Date;
  den: Date;
}

/**
 * Những ô THÁNG mà biểu đồ nên vẽ, sinh TỪ CHÍNH KỲ chứ không từ năm được chọn.
 *
 * Hai lỗi đã đi qua đây, cả hai đều làm các ô không cộng ra dòng tổng:
 *
 *   1. Ô đếm TRỌN tháng trong khi kỳ chỉ là 05/03–20/05 → nay đếm phần giao.
 *   2. Ô chỉ sinh trong `năm` được chọn, nên khoảng 01/11/2025–28/02/2026 ra bốn tháng ở dòng
 *      tổng nhưng chỉ hai ô trên biểu đồ — và một khoảng nằm trọn năm 2025 thì KHÔNG ô nào.
 *
 * Cả hai đều là cùng một hình dạng: ô và tổng dựng từ hai nguồn khác nhau. Nay chỉ một nguồn.
 */
export function thangTrongKy(ky: Ky): OBieuDo[] {
  const ra: OBieuDo[] = [];
  const d = new Date(ky.tu.getFullYear(), ky.tu.getMonth(), 1);
  while (d <= ky.den) {
    const g = giaoVoiKy(
      new Date(d.getFullYear(), d.getMonth(), 1),
      new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
      ky,
    );
    if (g) ra.push({ nam: d.getFullYear(), so: d.getMonth() + 1, ...g });
    d.setMonth(d.getMonth() + 1);
  }
  return ra;
}

/** Như `thangTrongKy`, cho quý. */
export function quyTrongKy(ky: Ky): OBieuDo[] {
  const ra: OBieuDo[] = [];
  const d = new Date(ky.tu.getFullYear(), Math.floor(ky.tu.getMonth() / 3) * 3, 1);
  while (d <= ky.den) {
    const g = giaoVoiKy(
      new Date(d.getFullYear(), d.getMonth(), 1),
      new Date(d.getFullYear(), d.getMonth() + 3, 0, 23, 59, 59, 999),
      ky,
    );
    if (g) ra.push({ nam: d.getFullYear(), so: Math.floor(d.getMonth() / 3) + 1, ...g });
    d.setMonth(d.getMonth() + 3);
  }
  return ra;
}

/**
 * Số ô mà một khoảng sẽ sinh ra — dùng cho phép chặn ở biên.
 *
 * Đếm bằng CHÍNH hàm sinh ô, không bằng một công thức riêng. Bản đầu chặn bằng
 * `Math.ceil(soThang / 3)`, và với khoảng không trùng mốc quý (01/02/2010–31/01/2025) nó ra 60
 * trong khi bộ sinh ra 61 — bộ chặn và bộ dựng đếm bằng HAI THƯỚC, nên trần bị lách mà không ai
 * thấy. Một hàm thì không có chỗ để lệch.
 */
export function demO(tu: Date, den: Date, don: 'thang' | 'quy'): number {
  const ky = { loai: 'TUY_CHON', nam: tu.getFullYear(), tu, den, nhan: '' } as Ky;
  return don === 'quy' ? quyTrongKy(ky).length : thangTrongKy(ky).length;
}
