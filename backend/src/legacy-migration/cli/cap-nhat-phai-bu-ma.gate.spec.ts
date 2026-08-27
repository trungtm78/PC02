import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: mọi đường NẠP hồ sơ hệ cũ phải bù mã ngay sau khi nạp.
 *
 * `LegacyMigrationService.commit` đặt mã TẠM (`DT-LEGACY-<khoá nguồn>`) lúc tạo và chờ một
 * bước cấp mã chạy sau. Bỏ bước ấy thì hai chuyện xảy ra cùng lúc, và cả hai đã xảy ra thật
 * ngày 28/08/2026 với 83 đơn thư vừa cập nhật:
 *
 *   • hồ sơ mang mã vô nghĩa — cán bộ tra theo mã hệ cũ (`2026-11253`) không thấy;
 *   • bộ đếm số tụt lại phía sau, nên hồ sơ tạo mới sau đó TRÙNG mã với hồ sơ vừa nạp. Đúng
 *     lớp sự cố đã chặn cả buổi sáng 25/08/2026.
 *
 * Chính chú thích đầu `backfill-ma-ho-so.ts` đã cảnh báo "MỖI LƯỢT NHẬP lại sinh thêm đơn thư
 * mã tạm" — cổng này biến lời cảnh báo ấy thành thứ máy kiểm được.
 */
const THU_MUC = __dirname;

/** Tệp thực hiện việc NẠP hồ sơ hệ cũ vào bảng vận hành. */
const DUONG_NAP = ['cap-nhat-tu-he-cu.ts', 'import.ts'];

function doc(ten: string): string {
  return fs.readFileSync(path.join(THU_MUC, ten), 'utf8');
}

/** Bỏ chú thích: một dòng chú thích nhắc tên hàm không phải là gọi hàm ấy. */
function boChuThich(ma: string): string {
  return ma.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

describe('GATE — đường nạp hồ sơ hệ cũ phải bù mã sau khi nạp', () => {
  it.each(DUONG_NAP)('%s gọi `buMaHoSo` sau khi nạp', (ten) => {
    const ma = boChuThich(doc(ten));
    expect(ma).toMatch(/buMaHoSo\s*\(/);
  });

  it.each(DUONG_NAP)('%s gọi bù mã ở chế độ GHI THẬT, không phải chỉ đọc', (ten) => {
    const ma = boChuThich(doc(ten));
    const goi = /buMaHoSo\s*\(([^)]*)\)/.exec(ma);
    expect(goi).not.toBeNull();
    expect(goi?.[1]).toContain('true');
  });

  /** Hàm bù mã phải dùng lại được — nằm trong `main()` thì không đường nào gọi tới. */
  it('`buMaHoSo` là hàm export, không nằm kín trong `main()`', () => {
    expect(doc('backfill-ma-ho-so.ts')).toMatch(/export async function buMaHoSo\s*\(/);
  });

  /** Và nó phải nhận `prisma` từ ngoài, nếu không mỗi lần gọi lại mở thêm một kết nối. */
  it('`buMaHoSo` nhận `prisma` từ nơi gọi', () => {
    const m = /export async function buMaHoSo\s*\(([^)]*)\)/.exec(doc('backfill-ma-ho-so.ts'));
    expect(m?.[1]).toContain('prisma');
  });
});
