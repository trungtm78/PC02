import * as fs from 'fs';
import * as path from 'path';

/**
 * Cổng: vai trò OFFICER phải có quyền ĐỌC danh mục.
 *
 * ── Vì sao cần cổng đọc thẳng mã nguồn ──
 *
 * Thiếu `read:Directory` thì `GET /directories` trả 403 và giao diện KHÔNG báo gì — ô chọn chỉ
 * đơn giản không có dòng nào. Cán bộ mở ô "Đơn vị xử lý" ra thấy rỗng và không có cách nào biết
 * vì sao; người phát triển nhìn giao diện cũng thấy "bình thường" vì admin có quyền.
 *
 * Đo trên máy thật 09/09/2026 bằng tài khoản cán bộ thật: 1.433 đơn vị xử lý vừa nạp, cán bộ
 * không thấy một dòng nào. Lỗi tồn tại từ lâu, không ca kiểm nào bắt được vì mọi ca kiểm chạy
 * với quyền đầy đủ.
 *
 * Đây là quyền ĐỌC danh mục tra cứu. Phạm vi dữ liệu hồ sơ vẫn do DataScope theo tổ/điều tra
 * viên giữ, không liên quan.
 */
describe('cổng: quyền đọc danh mục của cán bộ', () => {
  const seed = fs.readFileSync(path.join(__dirname, '../../prisma/seed.ts'), 'utf-8');

  /** Khối `officerReadPerms` trong seed.ts — nguồn duy nhất quyết định cán bộ đọc được gì. */
  const khoi = /const officerReadPerms[\s\S]*?\}\);/.exec(seed)?.[0] ?? '';

  it('tìm thấy khối khai quyền đọc của OFFICER trong seed', () => {
    // Không có dòng này thì đổi tên biến sẽ làm cổng chạy trên chuỗi rỗng và vẫn báo XANH.
    expect(khoi.length).toBeGreaterThan(80);
  });

  it.each(['Directory', 'Team', 'User', 'Case', 'Petition', 'Incident', 'Calendar'])(
    'OFFICER đọc được %s',
    (subject) => {
      expect(khoi).toContain(`'${subject}'`);
    },
  );
});
