import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import { catalogKeys } from './field-catalog';

/**
 * Cổng: MỌI biến `{…}` trong bộ mẫu Đơn thư phải có trong Field Catalog.
 *
 * Vì sao cần cổng này: bộ nạp mẫu (`petition-seed.ts`) dò placeholder thẳng từ tệp `.docx` rồi
 * khai `source: 'auto', field: <tên biến>`. Biến nào catalog KHÔNG có thì `resolveField` trả
 * chuỗi rỗng — bản in ra thiếu chữ, không ném lỗi, không ghi nhật ký. Gõ sai một chữ trong tên
 * biến là mất hẳn một ô trên văn bản gửi đi mà mọi ca kiểm vẫn xanh.
 *
 * Đây đúng lớp lỗi đã cắn: `donViNhan` đọc sai cột nên "Kính gửi:" in trống ở 47.169 hồ sơ, và
 * chỉ lộ ra khi anh chụp ảnh bản in gửi lại.
 */
describe('cổng — biến trong mẫu Đơn thư phải khớp Field Catalog', () => {
  const THU_MUC = path.join(__dirname, '../../prisma/seed-assets/petition-docx');
  const KHOA = new Set(catalogKeys('DON_THU'));

  const tep = fs
    .readdirSync(THU_MUC)
    .filter((f) => f.endsWith('.docx'))
    .sort();

  it('thư mục mẫu không rỗng — cổng phải thật sự chạy trên tệp', () => {
    // Không có dòng này thì thư mục đổi tên sẽ làm cổng chạy 0 tệp và vẫn báo XANH.
    expect(tep.length).toBeGreaterThanOrEqual(7);
  });

  it.each(tep)('%s — mọi biến đều có trong catalog', (ten) => {
    const zip = new PizZip(fs.readFileSync(path.join(THU_MUC, ten)));
    const xml = zip.file('word/document.xml')!.asText();
    // Bóc chữ theo đoạn rồi mới dò biến: docxtemplater ghép run trước khi thay, nên một biến
    // có thể bị cắt làm nhiều <w:t>. Dò trên XML thô sẽ bỏ sót đúng những biến ấy.
    const chu = xml
      .replace(/<w:p[ >]/g, '<w:p ')
      .split('')
      .map((doan) =>
        (doan.match(/<w:t[^>]*>(.*?)<\/w:t>/g) ?? [])
          .map((t) => t.replace(/<[^>]+>/g, ''))
          .join(''),
      )
      .join('\n');

    const bien = [...chu.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1].trim());
    const thieu = [...new Set(bien)].filter((b) => !KHOA.has(b));
    expect(thieu).toEqual([]);
  });
});
