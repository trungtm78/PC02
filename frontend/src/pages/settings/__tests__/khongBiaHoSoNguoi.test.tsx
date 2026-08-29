import { describe, it, expect } from 'vitest';

/**
 * Không màn nào được dựng hồ sơ NGƯỜI không có thật.
 *
 * ── Đo được gì trên MÁY THẬT ──
 *
 * Ngày 29/08/2026, mở `/settings` trên máy thật bằng tài khoản ADMIN. Tab "Người dùng" hiện một
 * bảng đầy đủ cột Tên · Email · Vai trò · Trạng thái · Thao tác, với ba dòng:
 *
 *     Nguyễn Văn A   nguyenvana@pc02.gov.vn   Admin           Hoạt động   [Sửa] [Xóa]
 *     Trần Thị B     tranthib@pc02.gov.vn     Điều tra viên   Hoạt động   [Sửa] [Xóa]
 *     Lê Văn C       levanc@pc02.gov.vn       Thư ký          Tạm khóa    [Sửa] [Xóa]
 *
 * Ba người ấy không tồn tại. Bảng không gọi máy chủ lần nào — các dòng nằm thẳng trong mã nguồn.
 * Không có chữ "ví dụ", "mẫu" hay "demo" ở đâu trên màn.
 *
 * Trong một hệ quản lý vụ án, một bảng nhân sự trông y như thật — có vai trò, có trạng thái
 * "Tạm khóa", có nút Xóa — là dữ liệu sai được trình bày như bản ghi thật. Cán bộ đọc "Lê Văn C
 * — Thư ký — Tạm khóa" không có cách nào biết đó là chữ trang trí.
 *
 * ── Luật ──
 *
 * Tên người, email, vai trò, trạng thái tài khoản: hoặc đến từ máy chủ, hoặc không hiện. Chỗ giữ
 * chỗ trong ô nhập (`placeholder`) thì được — nó tự khai là gợi ý.
 */

const TEP = import.meta.glob('../../../**/*.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

/** Bỏ chú thích và chuỗi `placeholder=` — hai chỗ tên ví dụ được phép xuất hiện. */
function phanHienThi(ma: string): string {
  let r = '';
  let i = 0;
  while (i < ma.length) {
    if (ma[i] === '/' && ma[i + 1] === '/') {
      while (i < ma.length && ma[i] !== chr10()) i++;
    } else if (ma[i] === '/' && ma[i + 1] === '*') {
      i += 2;
      while (i < ma.length && !(ma[i] === '*' && ma[i + 1] === '/')) i++;
      i += 2;
    } else {
      r += ma[i];
      i++;
    }
  }
  return r.replace(/placeholder=\{?["'][^"']*["']\}?/g, '');
}

function chr10(): string {
  return String.fromCharCode(10);
}

/** Email trong miền của cơ quan, viết cứng ngoài chú thích và ngoài placeholder. */
const EMAIL_BIA = /["'][a-z.]+@pc02\.(gov\.vn|local)["']/;

describe('Không bịa hồ sơ người', () => {
  it('không tệp giao diện nào viết cứng email cán bộ để HIỂN THỊ', () => {
    const pham: string[] = [];
    for (const [ten, ma] of Object.entries(TEP)) {
      if (ten.includes('__tests__') || ten.includes('.test.')) continue;
      if (EMAIL_BIA.test(phanHienThi(ma))) pham.push(ten);
    }
    expect(pham).toEqual([]);
  });
});
