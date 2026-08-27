import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: mọi khoá ngoại mà `resolveCrime` / builder đặt dạng VÔ HƯỚNG phải có tên trong
 * `FK_RELATIONS`.
 *
 * Lệnh ghi Vụ việc và Vụ án là kiểu NGHIÊM NGẶT của Prisma: khi trong cùng một lệnh đã có bất
 * kỳ trường quan hệ nào (`createdBy: { connect }`), Prisma TỪ CHỐI mọi khoá ngoại vô hướng còn
 * lại và ném "Unknown argument `<khoá>`" — hỏng CẢ bản ghi, không phải chỉ một ô.
 *
 * Đây không phải rủi ro giả định: đo trên dữ liệu thật 25/08/2026, trộn hai kiểu đã làm hỏng
 * 4.915 đơn thư, và vì đó là lượt CẬP NHẬT nên hỏng nghĩa là sửa đổi bên hệ cũ không sang được
 * hệ mới.
 *
 * Đọc thẳng mã nguồn thay vì dựng bản giả: cái cần gác là hai bảng khai có khớp nhau không, mà
 * bản giả thì luôn khớp.
 */
const NGUON_SERVICE = fs.readFileSync(
  path.join(__dirname, 'legacy-migration.service.ts'),
  'utf8',
);

/** Tên khoá ngoại vô hướng mà `FK_RELATIONS` khai sẽ đổi sang dạng `connect`. */
function khoaDaKhai(): string[] {
  const khoi = /const FK_RELATIONS: Record<string, string> = \{([\s\S]*?)\n\};/.exec(NGUON_SERVICE);
  if (!khoi) return [];
  return Array.from(khoi[1].matchAll(/^\s*(\w+):\s*'/gm)).map((m) => m[1]);
}

describe('Khoá ngoại vô hướng phải được khai để đổi sang connect', () => {
  const daKhai = khoaDaKhai();

  it('đọc được bảng khai, không rơi về rỗng khi biểu thức hỏng', () => {
    expect(daKhai.length).toBeGreaterThanOrEqual(4);
    expect(daKhai).toContain('createdById');
  });

  /**
   * `resolveCrime` đặt `data.crimeChinhId` cho nhánh KHÔNG phải Vụ án. Nhánh Vụ việc đi qua
   * `toRelationConnect`, nên thiếu khai là hỏng cả bản ghi ngay lượt ghi đầu tiên.
   */
  it('crimeChinhId đã được khai', () => {
    expect(daKhai).toContain('crimeChinhId');
  });

  it('resolveCrime nhận cả ba thực thể', () => {
    expect(NGUON_SERVICE).toContain("target: 'petition' | 'case' | 'incident'");
  });

  /**
   * Mọi khoá vô hướng `resolveCrime` có thể đặt đều phải có tên trong bảng khai. Thêm một
   * nhánh phân giải mới mà quên khai là cổng đỏ ngay, thay vì hỏng trên máy chạy.
   */
  it('mọi khoá vô hướng resolveCrime đặt đều đã khai', () => {
    const than = NGUON_SERVICE.slice(
      NGUON_SERVICE.indexOf('private async resolveCrime'),
      NGUON_SERVICE.indexOf('// Commit: upsert theo legacySourceId'),
    );
    const dat = Array.from(than.matchAll(/data\.(\w*Id)\s*=/g)).map((m) => m[1]);
    expect(dat.length).toBeGreaterThan(0);
    expect(dat.filter((k) => !daKhai.includes(k))).toEqual([]);
  });
});
