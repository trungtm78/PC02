import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CỔNG: mọi nơi IN "Ngày viết đơn" phải đi qua `ngayVietDonHienThi`.
 *
 * Hồ sơ giữ hai cột — `petitionDate` (ngày thật, chỉ có khi nhập ĐỦ) và `ngayVietDonEdtf`
 * (EDTF, có cả khi nhập thiếu). Nơi nào đọc thẳng `petitionDate` để in thì đơn nhập thiếu
 * thành phần sẽ in ra RỖNG — mất thông tin cán bộ đã nhập, và mất im lặng: bản in trông vẫn
 * bình thường, chỉ thiếu một dòng.
 *
 * Gieo lỗi: đổi một `resolve` về `fmtDate(r.petitionDate)` thì cổng này đỏ.
 */
const GOC = join(__dirname, '..', '..');

/** Bỏ chú thích — cổng kiểm MÃ, không kiểm lời văn giải thích. */
function boChuThich(than: string): string {
  return than.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Mọi nơi in Ngày viết đơn đi qua một hàm', () => {
  const tep = join(GOC, 'src', 'document-templates', 'field-catalog.ts');
  const than = boChuThich(readFileSync(tep, 'utf8'));

  it('catalog chứng từ KHÔNG đọc thẳng `r.petitionDate` trong `resolve`', () => {
    const pham = than
      .split('\n')
      .filter((d) => /resolve:/.test(d) && /r\.petitionDate/.test(d));
    expect(pham).toEqual([]);
  });

  it('có dùng `ngayVietDonHienThi` — cổng quét 0 chỗ mà vẫn xanh là cổng vô nghĩa', () => {
    expect(than).toMatch(/ngayVietDonHienThi\s*\(/);
  });
});
