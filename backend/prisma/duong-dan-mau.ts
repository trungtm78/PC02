import * as fs from 'fs';
import * as path from 'path';

/**
 * Tìm thư mục chứa file mẫu `.docx`, chạy được cả từ mã nguồn lẫn từ bản biên dịch.
 *
 * Bộ seed trên máy thật chạy từ `dist/`, mà bước biên dịch chỉ chép mã `.ts` — file `.docx`
 * nằm nguyên ở `prisma/seed-assets/`. Trỏ thẳng `path.resolve(__dirname, 'seed-assets', …)`
 * từ `dist/prisma` là vào chỗ KHÔNG có file, và seed báo "thiếu file" rồi bỏ qua sạch: chạy
 * xong 0 mẫu, không lỗi, không ai biết cho tới lúc cán bộ bấm In.
 *
 * Đúng chuyện đã xảy ra ngày 28/08/2026 khi nạp bộ mẫu hệ cũ, và cùng lớp với sự cố deploy
 * v0.47.0.2 — `nest-cli.json` không tự bundle assets.
 *
 * Dò lần lượt: cạnh nơi gọi (mã nguồn) → lùi ra khỏi `dist` (bản biên dịch). Không thấy ở đâu
 * thì trả đường đầu tiên, để thông báo "thiếu file" vẫn chỉ đúng chỗ người ta cần đặt file.
 */
export function timThuMucMau(thuMucGoc: string, ten: string): string {
  const ungVien = [
    path.resolve(thuMucGoc, 'seed-assets', ten),
    // `dist/prisma` → `prisma`: lùi hai bậc rồi vào lại thư mục nguồn.
    path.resolve(thuMucGoc, '..', '..', 'prisma', 'seed-assets', ten),
    path.resolve(thuMucGoc, '..', 'prisma', 'seed-assets', ten),
  ];
  for (const d of ungVien) {
    if (fs.existsSync(d)) return d;
  }
  return ungVien[0];
}
