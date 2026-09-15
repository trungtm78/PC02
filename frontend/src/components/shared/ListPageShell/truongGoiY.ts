import type { TruongTimKiem } from '@/shared/tim-kiem/the';

/**
 * Trường gợi ý cho ô tìm kiếm dạng thẻ = các cột ĐANG HIỆN có khai `timKiem`, đúng thứ tự trên
 * bảng. Suy từ cột chứ không khai danh sách riêng: danh sách riêng lệch khỏi bảng ngay lần đầu
 * ai đó thêm hay ẩn cột, và không gì báo.
 */
export function truongGoiY<C extends { timKiem?: string | readonly string[] }>(
  cot: readonly C[],
  khai: readonly TruongTimKiem[],
): TruongTimKiem[] {
  const ra: TruongTimKiem[] = [];
  for (const c of cot) {
    const khoa = c.timKiem === undefined ? [] : typeof c.timKiem === 'string' ? [c.timKiem] : c.timKiem;
    for (const k of khoa) {
      const t = khai.find((x) => x.key === k);
      if (t && !ra.includes(t)) ra.push(t);
    }
  }
  return ra;
}
