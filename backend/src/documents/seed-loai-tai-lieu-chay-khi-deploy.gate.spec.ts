import * as fs from 'fs';
import * as path from 'path';
import { LOAI_TAI_LIEU } from '../../prisma/seed-directory-types';

/**
 * CỔNG: mã `DOCUMENT_TYPE` phải được seed MỖI LẦN DEPLOY.
 *
 * Mã danh mục thiếu trên máy chạy không gây lỗi nào: khu tải tệp chuyên đề mở ra rỗng, ô chọn
 * loại không có lựa chọn nào, và cán bộ kết luận "chức năng hỏng". Mọi ca kiểm ở máy vẫn xanh
 * vì máy đã chạy seed đầy đủ từ lâu — đúng lớp "khe hở giữa bộ nạp và bộ đọc".
 *
 * Nên nối HAI phía bằng một phép đo: hằng số trong mã ↔ bước seed trong `deploy.sh`.
 */
const GOC = path.resolve(__dirname, '..', '..', '..');
const DEPLOY = path.join(GOC, 'scripts', 'deploy', 'deploy.sh');

describe('CỔNG: seed DOCUMENT_TYPE chạy khi deploy', () => {
  const sh = fs.readFileSync(DEPLOY, 'utf8');

  it('đọc được deploy.sh và thấy các bước seed khác', () => {
    expect(sh).toContain('seed-document-numbers.ts');
  });

  it('deploy.sh CÓ gọi bộ seed loại tài liệu', () => {
    expect(sh).toContain('prisma/seed-loai-tai-lieu.ts');
  });

  it('seed hỏng thì ABORT deploy, không đi tiếp im lặng', () => {
    const i = sh.indexOf('prisma/seed-loai-tai-lieu.ts');
    // Đọc khối lệnh ngay sau lời gọi: phải có `exit 1`, không phải chỉ WARN.
    expect(sh.slice(i, i + 300)).toContain('exit 1');
  });

  /**
   * Cùng lớp lỗi, khác bảng: thiếu một dòng `permissions` thì `@RequirePermissions` trả 403 cho
   * MỌI vai, kể cả ADMIN — `seed.ts` cấp quyền cho ADMIN bằng `findMany()` trên những dòng chưa
   * tồn tại. Ship một tính năng kèm quyền mới mà không seed quyền là tính năng chết ngay khi
   * lên máy thật, và chết bằng 403 chứ không bằng lỗi nào đọc được.
   */
  it('deploy.sh CÓ gọi bộ seed quyền, và hỏng thì ABORT', () => {
    expect(sh).toContain('prisma/seed-quyen.ts');
    const i = sh.indexOf('prisma/seed-quyen.ts');
    expect(sh.slice(i, i + 300)).toContain('exit 1');
  });

  it('mọi @RequirePermissions trong controller Đơn thư đều có dòng seed tương ứng', () => {
    const ctl = fs.readFileSync(
      path.join(GOC, 'backend', 'src', 'petitions', 'petitions.controller.ts'),
      'utf8',
    );
    /*
      BỎ dòng đã chú thích trước khi dò.

      Bản đầu dò thẳng trên nguyên tệp, nên chú thích một dòng quyền lại rồi mà cổng vẫn xanh —
      chuỗi vẫn còn nguyên trong tệp, chỉ là máy chủ không bao giờ đọc tới. Cổng đo sự có mặt
      của một dòng CHỮ, không đo dòng quyền có thật hay không.
    */
    const seed = fs
      .readFileSync(path.join(GOC, 'backend', 'prisma', 'seed-permissions.ts'), 'utf8')
      .split(/\r?\n/)
      .filter((d) => !d.trimStart().startsWith('//'))
      .join(String.fromCharCode(10));
    const can = [
      ...ctl.matchAll(/action:\s*'([a-z_]+)'\s*,\s*subject:\s*'([A-Za-z]+)'/g),
    ].map((m) => `${m[1]}|${m[2]}`);
    expect(can.length).toBeGreaterThan(4);
    const co = new Set(
      [...seed.matchAll(/action:\s*'([a-z_]+)'\s*,\s*subject:\s*'([A-Za-z]+)'/g)].map(
        (m) => `${m[1]}|${m[2]}`,
      ),
    );
    expect([...new Set(can)].filter((k) => !co.has(k))).toEqual([]);
  });

  it('hằng số danh mục không rỗng và có mã của khu tệp kết quả', () => {
    expect(LOAI_TAI_LIEU.length).toBeGreaterThanOrEqual(6);
    expect(LOAI_TAI_LIEU.map((m) => m.code)).toContain('KET_QUA_DON_VI_XU_LY');
    expect(LOAI_TAI_LIEU.every((m) => m.type === 'DOCUMENT_TYPE')).toBe(true);
  });
});
