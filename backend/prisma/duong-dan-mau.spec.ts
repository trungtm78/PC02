import * as fs from 'fs';
import * as path from 'path';
import { timThuMucMau } from './duong-dan-mau';

/**
 * Bộ seed chạy từ `dist/` trên máy thật, nhưng bước biên dịch chỉ chép mã `.ts` — file `.docx`
 * nằm nguyên ở thư mục nguồn. Nên `path.resolve(__dirname, …)` từ `dist/prisma` trỏ vào chỗ
 * KHÔNG có file, và seed báo "thiếu file" rồi bỏ qua sạch: chạy xong 0 mẫu, không lỗi, không
 * ai biết cho tới lúc bấm In.
 *
 * Đúng lớp đã làm hỏng deploy v0.47.0.2 — `nest-cli.json` không tự bundle assets.
 */
describe('timThuMucMau — tìm được file .docx cả khi chạy từ bản biên dịch', () => {
  it('trả thư mục CÓ file khi chạy từ mã nguồn', () => {
    const d = timThuMucMau(__dirname, 'legacy-docx');
    expect(fs.existsSync(path.join(d, 'don_thu_mau.docx'))).toBe(true);
  });

  it('chạy từ `dist/prisma` vẫn tìm ra thư mục nguồn', () => {
    const gia = path.resolve(__dirname, '..', 'dist', 'prisma');
    const d = timThuMucMau(gia, 'legacy-docx');
    expect(fs.existsSync(path.join(d, 'don_thu_mau.docx'))).toBe(true);
  });

  it('bộ mẫu Đơn thư cũng tìm được', () => {
    const gia = path.resolve(__dirname, '..', 'dist', 'prisma');
    const d = timThuMucMau(gia, 'petition-docx');
    expect(fs.existsSync(path.join(d, 'BIEN_NHAN.docx'))).toBe(true);
  });

  /** Không tìm thấy ở đâu thì trả đường mặc định để thông báo "thiếu file" vẫn chỉ đúng chỗ. */
  it('không có ở đâu thì trả đường cạnh nơi gọi', () => {
    const d = timThuMucMau(__dirname, 'khong-co-thu-muc-nay');
    expect(d).toContain('khong-co-thu-muc-nay');
  });
});

/**
 * CỔNG: mọi bộ seed mẫu phải dò đường bằng `timThuMucMau`, không trỏ thẳng `__dirname`.
 *
 * Trỏ thẳng thì trên máy thật seed chạy xong **0 mẫu** mà không báo lỗi — chỉ in vài dòng
 * "thiếu file" giữa hàng chục dòng khác, và không ai biết cho tới lúc cán bộ bấm In.
 */
describe('GATE — bộ seed mẫu không trỏ thẳng thư mục', () => {
  it.each(['seed-legacy-templates.ts', 'seed-document-templates.ts'])(
    '%s dùng `timThuMucMau`',
    (ten) => {
      const ma = fs.readFileSync(path.join(__dirname, ten), 'utf8');
      expect(ma).toContain('timThuMucMau(');
      // Không còn đường trỏ thẳng vào `seed-assets` — đó là đường vỡ khi chạy từ `dist`.
      expect(ma).not.toMatch(/path\.resolve\(__dirname,\s*'seed-assets'/);
    },
  );
});
