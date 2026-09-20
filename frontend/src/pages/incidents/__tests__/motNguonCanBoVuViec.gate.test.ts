import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * CỔNG: màn Vụ việc và Vụ án chỉ lấy danh sách cán bộ từ `useOfficerOptions`.
 *
 * Cùng lỗi đã vá ở màn Đơn thư: lời gọi riêng `GET /admin/users?limit=200` không phân trang
 * và không lọc `status`, nên trên bản đang chạy (245 tài khoản hoạt động) ô chọn THIẾU ~45
 * người và còn kéo cả tài khoản ĐÃ KHOÁ vào. Hỏng im lặng — không lỗi, không cảnh báo, chỉ là
 * có cán bộ không chọn được.
 */
const THU_MUC = [
  'src/pages/incidents',
  'src/pages/cases',
  'src/features/incidents',
  'src/features/cases',
];

function moiTepNguon(thuMuc: string): string[] {
  if (!existsSync(thuMuc)) return [];
  return readdirSync(thuMuc).flatMap((ten) => {
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) return ten === '__tests__' ? [] : moiTepNguon(duong);
    return /\.tsx?$/.test(ten) && !/\.test\.tsx?$/.test(ten) ? [duong] : [];
  });
}

/** Bỏ chú thích trước khi soi — cổng kiểm MÃ, không kiểm lời văn giải thích. */
function boChuThich(than: string): string {
  return than.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Màn Vụ việc / Vụ án chỉ lấy cán bộ từ useOfficerOptions', () => {
  const tep = THU_MUC.flatMap((t) => moiTepNguon(join(process.cwd(), t)));

  it('có tệp để quét — cổng quét 0 tệp mà vẫn xanh là cổng vô nghĩa', () => {
    expect(tep.length).toBeGreaterThan(10);
  });

  it('không tệp nào nhắc tới đường /admin/users dưới bất kỳ dạng nào', () => {
    const pham = tep
      .filter((d) => /\/admin\/users/.test(boChuThich(readFileSync(d, 'utf8'))))
      .map((d) => relative(process.cwd(), d));
    expect(pham).toEqual([]);
  });
});
