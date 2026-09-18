import { describe, it, expect, beforeEach } from 'vitest';
import { trangDangRanh } from '../trangDangRanh';

/**
 * CỔNG: mọi màn nhập liệu khai trong định tuyến đều được `trangDangRanh` nhận là KHÔNG rảnh.
 *
 * App tự lên bản mới khi cán bộ quay lại tab mà trang "rảnh". Một màn nhập liệu mới thêm với tên
 * đường dẫn lạ (vd `/ho-so/tao`) mà luật không nhận ra thì sẽ bị tải lại giữa lúc đang gõ. Cổng
 * này đọc CHÍNH các tệp định tuyến, nên thêm màn mới là tự vào cổng.
 */
const TEP_DINH_TUYEN = import.meta.glob('/src/features/*/routes.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Đường dẫn có dấu hiệu là màn nhập liệu. */
const LA_MAN_NHAP = /(^|\/)(new|edit|create|them|sua|tao|add-[^/]*)(\/|$)/i;

const duongDanForm = Object.values(TEP_DINH_TUYEN)
  .flatMap((src) => [...src.matchAll(/path="([^"]+)"/g)].map((m) => m[1]))
  .filter((p) => LA_MAN_NHAP.test(p))
  .map((p) => p.replace(/:[A-Za-z]+/g, 'abc123'));

describe('CỔNG màn nhập liệu — không bao giờ tự tải lại', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('cổng không rỗng: đọc được các màn nhập liệu từ định tuyến', () => {
    expect(duongDanForm.length).toBeGreaterThanOrEqual(10);
    expect(duongDanForm).toContain('/petitions/new');
    expect(duongDanForm).toContain('/add-new-record');
  });

  it.each(duongDanForm)('%s: trang KHÔNG rảnh', (duong) => {
    expect(trangDangRanh(document, duong)).toBe(false);
  });

  it('gieo lỗi: đường dẫn nhập liệu kiểu lạ bị cổng phát hiện nếu luật không nhận ra', () => {
    // `/ho-so/tao` là màn nhập liệu theo dấu hiệu tên, nhưng luật hiện tại không biết `tao`.
    // Nếu ai thêm route như vậy, ca `it.each` phía trên sẽ đỏ — ở đây kiểm chính cơ chế ấy.
    expect(LA_MAN_NHAP.test('/ho-so/tao')).toBe(true);
    expect(trangDangRanh(document, '/ho-so/tao')).toBe(true);
  });
});
