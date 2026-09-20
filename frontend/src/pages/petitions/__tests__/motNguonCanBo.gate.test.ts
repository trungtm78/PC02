import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * CỔNG: màn Đơn thư chỉ có MỘT nguồn danh sách cán bộ — `useOfficerOptions`.
 *
 * Form Đơn thư từng tự gọi `GET /admin/users` với `limit` 200 trong khi hook dùng chung đã
 * phân trang 500 từ 19/09/2026. Prod có 245 tài khoản đang hoạt động, nên ô chọn cán bộ của
 * form THIẾU ~45 người và còn kéo cả tài khoản ĐÃ KHOÁ vào (lời gọi riêng không lọc `status`).
 *
 * Hỏng im lặng: không lỗi, không cảnh báo — chỉ là có cán bộ không chọn được.
 *
 * Bản đầu của cổng này chỉ khớp khi đường dẫn đứng NGAY SAU dấu nháy, nên một chuỗi mẫu
 * `` `${GOC}/admin/users` `` đi lọt; và nó chỉ soi `pages/petitions`, bỏ trống
 * `features/petitions` — đúng chỗ thành phần Đơn thư kế tiếp sẽ nằm. Cả hai đã được vá.
 */
const THU_MUC_DON_THU = ['src/pages/petitions', 'src/features/petitions'];

function moiTepNguon(thuMuc: string): string[] {
  if (!existsSync(thuMuc)) return [];
  return readdirSync(thuMuc).flatMap((ten) => {
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) {
      return ten === '__tests__' ? [] : moiTepNguon(duong);
    }
    return /\.tsx?$/.test(ten) && !/\.test\.tsx?$/.test(ten) ? [duong] : [];
  });
}

/** Bỏ chú thích trước khi soi — cổng kiểm MÃ, không kiểm lời văn giải thích. */
function boChuThich(than: string): string {
  return than.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function tepDonThu(): string[] {
  return THU_MUC_DON_THU.flatMap((t) => moiTepNguon(join(process.cwd(), t)));
}

describe('Màn Đơn thư chỉ lấy danh sách cán bộ từ useOfficerOptions', () => {
  it('quét cả pages/petitions lẫn features/petitions, và có tệp để quét', () => {
    // Không có mệnh đề này thì một lần đổi đường dẫn làm cổng quét 0 tệp mà vẫn xanh.
    expect(tepDonThu().length).toBeGreaterThan(5);
    THU_MUC_DON_THU.forEach((t) => expect(existsSync(join(process.cwd(), t))).toBe(true));
  });

  it('không tệp nào nhắc tới đường /admin/users dưới bất kỳ dạng nào', () => {
    // Không đòi dấu nháy đứng trước: chuỗi mẫu, nối chuỗi, hằng số đường dẫn đều bị bắt.
    const pham = tepDonThu()
      .filter((duong) => /\/admin\/users/.test(boChuThich(readFileSync(duong, 'utf8'))))
      .map((duong) => relative(process.cwd(), duong));
    expect(pham).toEqual([]);
  });

  it('form Đơn thư GỌI useOfficerOptions, không chỉ nhắc tên nó', () => {
    const than = boChuThich(
      readFileSync(join(process.cwd(), 'src/pages/petitions/PetitionFormPage/index.tsx'), 'utf8'),
    );
    expect(than).toMatch(/useOfficerOptions\s*\(/);
  });
});
