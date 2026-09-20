import type { NhomOKhai } from "./NhomOGap";

/**
 * Kiểm một bảng khai nhóm có hợp lệ với bố cục không. Trả danh sách lỗi (rỗng = đạt).
 *
 * Dùng trong cổng ca kiểm, KHÔNG chạy lúc dựng giao diện: đây là lỗi của người khai bảng
 * nhóm, phải đỏ ở CI chứ không phải nổ trước mặt cán bộ.
 */
export function kiemNhomLienNhau<TForm>(
  items: readonly { field: string }[],
  nhom: readonly NhomOKhai<TForm>[],
): string[] {
  const loi: string[] = [];
  const viTri = new Map<string, number>();
  items.forEach((it, i) => {
    if (!viTri.has(it.field)) viTri.set(it.field, i);
  });

  const daThuocNhom = new Map<string, string>();
  for (const n of nhom) {
    const chiSo: number[] = [];
    for (const o of n.o) {
      const i = viTri.get(o);
      if (i === undefined) {
        // Gõ nhầm tên ô thì nhóm rỗng lặng lẽ — ô vẫn hiện ngoài nhóm, không ai biết sai.
        loi.push(`Nhóm "${n.khoa}": ô "${o}" không có trong bố cục`);
        continue;
      }
      const chu = daThuocNhom.get(o);
      if (chu) loi.push(`Ô "${o}" thuộc cả nhóm "${chu}" lẫn nhóm "${n.khoa}"`);
      daThuocNhom.set(o, n.khoa);
      chiSo.push(i);
    }
    if (chiSo.length < 2) continue;
    chiSo.sort((a, b) => a - b);
    const lienNhau = chiSo.every((v, k) => k === 0 || v === chiSo[k - 1] + 1);
    if (!lienNhau) {
      loi.push(
        `Nhóm "${n.khoa}": các ô không liền nhau trong bố cục (${n.o.join(", ")}) — ` +
          `gom tập rời làm ô xen giữa phải dời chỗ và lệch cột mọi ô phía sau`,
      );
    }
  }
  return loi;
}
