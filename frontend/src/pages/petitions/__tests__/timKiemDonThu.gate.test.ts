import { describe, it, expect } from 'vitest';
import src from '../PetitionListPageShell.tsx?raw';
import { TIM_KIEM_DON_THU } from '@/shared/tim-kiem/generated';

/**
 * CỔNG: mọi trường tìm được của Đơn thư phải có CỘT mang nó trên danh sách, và cột không mang
 * khoá lạ.
 *
 * Gợi ý của ô thẻ suy từ cột đang hiện. Trường khai ở máy chủ mà không cột nào mang thì cán bộ
 * không bao giờ chọn được nó — chỉ còn lối dán đường dẫn tay. Khoá lạ trên cột thì gợi ý lặng lẽ
 * biến mất. Cả hai đều không làm ca kiểm nào đỏ nếu thiếu cổng này.
 *
 * Đọc mã nguồn dạng văn bản (`?raw`) vì cột được dựng bên trong component.
 */

function khoaTrenCot(src: string): Set<string> {
  const ra = new Set<string>();
  for (const m of src.matchAll(/timKiem:\s*(\[[^\]]*\]|'[^']*')/g)) {
    for (const k of m[1].matchAll(/'([^']+)'/g)) ra.add(k[1]);
  }
  return ra;
}

const KHAI = TIM_KIEM_DON_THU.map((t) => t.key as string);

describe('GATE tìm kiếm Đơn thư — cột ↔ khai', () => {
  it('mọi trường khai đều có cột mang nó', () => {
    const coCot = khoaTrenCot(src);
    expect(KHAI.filter((k) => !coCot.has(k))).toEqual([]);
  });

  it('không cột nào mang khoá không có trong khai', () => {
    expect([...khoaTrenCot(src)].filter((k) => !KHAI.includes(k))).toEqual([]);
  });

  it('gieo lỗi: gỡ khoá một cột thì cổng bắt được', () => {
    const hong = src.replace(/timKiem:\s*'tomTat'/, '');
    expect(hong).not.toBe(src);
    expect(KHAI.filter((k) => !khoaTrenCot(hong).has(k))).toEqual(['tomTat']);
  });
});
