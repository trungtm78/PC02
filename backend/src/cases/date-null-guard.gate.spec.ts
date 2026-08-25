import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: không được đổi một ô ngày sang `Date` mà chưa chắc ô ấy có giá trị.
 *
 * `new Date(null)` không ném lỗi — nó trả về 01/01/1970. Một ô ngày để trống vì thế biến
 * thành một mốc tố tụng có thật trong cơ sở dữ liệu, và mọi phép tính thời hạn dựa trên nó
 * đều sai theo. Kiểu hỏng này im lặng: không có ngoại lệ, không có bản ghi lỗi, chỉ có một
 * con số vô lý nằm trong hồ sơ.
 *
 * Trước 26/08/2026 lớp giao diện BỎ HẲN ô rỗng khỏi lời gọi nên chỗ này không bao giờ nhận
 * `null` — lỗi nằm im. Từ khi ô rỗng gửi `null` (để xoá được), nhánh không có ngoại lệ ấy
 * trở thành đường đi thường ngày.
 */
describe('Ô ngày rỗng không được biến thành 01/01/1970', () => {
  const NGUON = path.join(__dirname, 'cases.service.ts');

  it('mọi new Date(dto.x) đều có nhánh cho ô rỗng', () => {
    const XUONG_DONG = String.fromCharCode(10);
    const dong = fs.readFileSync(NGUON, 'utf8').split(XUONG_DONG);
    const hong: string[] = [];
    dong.forEach((l, i) => {
      for (const m of l.matchAll(/new Date\(dto\.(\w+)\)/g)) {
        const k = m[1];
        if (!l.includes(`dto.${k} ?`)) hong.push(`cases.service.ts:${i + 1} — ${k}`);
      }
    });
    expect(hong).toEqual([]);
  });
});
