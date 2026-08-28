import * as fs from 'fs';
import * as path from 'path';

/**
 * Mọi chỗ dựng `PrismaClient` phải khai bộ nối (`adapter`).
 *
 * ── Vì sao cần cổng đọc thẳng mã nguồn ──
 *
 * Prisma 7 bỏ trình điều khiển dựng sẵn: `new PrismaClient()` trần **ném ngay lúc dựng**. Ca
 * kiểm không bắt được vì CLI di trú vốn không có ca kiểm chạy thật — chúng cần CSDL. Lỗi chỉ
 * lộ khi đã đứng trên máy thật, giữa lúc chạy một bước nạp dữ liệu.
 *
 * Ngày 28/08/2026 bộ nạp `nap-ten-ngan-can-bo.ts` đã ném đúng kiểu ấy trên máy thật, sau khi
 * qua trọn 3.781 ca kiểm và hai vòng soát độc lập.
 *
 * Cổng này chạy được ở CI: nó chỉ đọc mã nguồn, không cần CSDL.
 */
const THU_MUC = __dirname;

function tepCli(): string[] {
  return fs
    .readdirSync(THU_MUC)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .filter((f) => fs.readFileSync(path.join(THU_MUC, f), 'utf-8').includes('new PrismaClient'));
}

describe('Cổng: PrismaClient phải khai bộ nối', () => {
  const tep = tepCli();

  it('có tệp CLI dùng PrismaClient để mà canh', () => {
    expect(tep.length).toBeGreaterThan(10);
  });

  it.each(tep)('%s khai adapter ở MỌI chỗ dựng PrismaClient', (ten) => {
    const ma = fs.readFileSync(path.join(THU_MUC, ten), 'utf-8');
    // Bắt cả dạng một dòng lẫn dạng nhiều dòng: lấy 200 ký tự sau mỗi chỗ dựng và soi trong đó.
    const thieu = [...ma.matchAll(/new PrismaClient\(/g)]
      .map((m) => ma.slice(m.index ?? 0, (m.index ?? 0) + 200))
      .filter((doan) => !doan.includes('adapter'));
    expect(thieu).toEqual([]);
  });
});
