import { describe, it, expect } from 'vitest';

/**
 * CỔNG LỚP — trang nào đã khai `LoadErrorBanner` thì MỌI ô số liệu trên trang ấy phải đi qua
 * `soLieuHienThi`.
 *
 * ── Vì sao cần cổng thay vì chỉ sửa từng ô ──
 *
 * Bản vá đầu bọc số liệu bằng một biểu thức chỉ khớp ĐỊNH DANH ĐƠN (`{totalCount}`), nên bỏ sót
 * mọi ô tính bằng biểu thức:
 *
 *     {allData.filter((log) => …).length}
 *     {selectedIds.length > 0 ? selectedIds.length : filteredData.length}
 *     {loading ? "—" : totalCount}
 *
 * Codex bắt đúng hai chỗ ấy. Kết quả là màn hình có khối đỏ nói "số liệu bên dưới để trống",
 * ngay bên dưới lại là một con số 0 trông rất thật — tệ hơn cả khi chưa vá, vì nó tự mâu thuẫn.
 *
 * Sửa từng ô thì lần sau ai thêm một thẻ mới lại lọt. Cổng này quét theo LỚP: hễ trang có khối
 * báo lỗi thì mọi thẻ số liệu trên trang phải được bọc.
 */
const TRANG = import.meta.glob('../**/*.tsx', { eager: true, query: '?raw', import: 'default' }) as Record<
  string,
  string
>;

/** Thẻ số liệu = `<p class="text-2xl|3xl font-bold …">` — quy ước dùng chung của mọi trang danh sách. */
function oSoLieuChuaBoc(ma: string): string[] {
  const dong = ma.split('\n');
  const sot: string[] = [];
  for (let i = 0; i < dong.length; i++) {
    // Chỉ thẻ `<p>` mới là ô số liệu; `<h1>`/`<h2>` cùng cỡ chữ là TIÊU ĐỀ (vd "Truy cập bị
    // từ chối") — cổng bắt nhầm chúng thì nó đỏ vì lý do sai và sẽ bị người sau tắt đi.
    if (!/<p [^>]*text-[23]xl font-bold/.test(dong[i])) continue;
    const khoi = dong.slice(i, i + 4).join(' ');
    // Chỉ xét thẻ CÓ nội dung động; tiêu đề tĩnh (vd "Truy cập bị từ chối") không phải số liệu.
    if (!khoi.includes('{')) continue;
    if (!khoi.includes('soLieuHienThi')) sot.push(khoi.trim().slice(0, 100));
  }
  return sot;
}

describe('Cổng: trang có khối báo tải hỏng thì mọi ô số liệu phải được bọc', () => {
  const coBanner = Object.entries(TRANG).filter(([, ma]) => ma.includes('LoadErrorBanner'));

  it('có ít nhất một trang khai LoadErrorBanner (cổng này không rỗng)', () => {
    expect(coBanner.length).toBeGreaterThan(0);
  });

  it.each(coBanner.map(([d]) => [d.split('/').pop() ?? d, d]))(
    '%s — không ô số liệu nào bỏ sót',
    (_ten, duong) => {
      const ma = TRANG[duong];
      expect(oSoLieuChuaBoc(ma)).toEqual([]);
    },
  );
});

/**
 * CỔNG LỚP thứ hai — trang có `LoadErrorBanner` thì phải XOÁ lỗi cũ mỗi lần nạp lại.
 *
 * Codex bắt ở màn KPI: `loadError` được đặt khi hỏng nhưng không ai xoá, nên đổi năm/quý/tháng
 * rồi nạp lại THÀNH CÔNG vẫn còn khối đỏ đứng đó — mâu thuẫn với chính số liệu bên dưới, và
 * người dùng không biết tin cái nào.
 *
 * Cùng lớp với lỗi `supplementError` bám lại ở tab Bổ sung điều tra: trạng thái lỗi dính vào
 * TRANG chứ không dính vào lần hỏi. Sửa từng chỗ thì lần sau lại lọt, nên quét theo lớp.
 */
describe('Cổng: trang có khối báo tải hỏng thì phải dọn lỗi cũ mỗi lần nạp', () => {
  const coBanner = Object.entries(TRANG).filter(([, ma]) => ma.includes('LoadErrorBanner'));

  it.each(coBanner.map(([d]) => [d.split('/').pop() ?? d, d]))(
    '%s — có dọn setLoadError("")',
    (_ten, duong) => {
      const ma = TRANG[duong];
      // Đặt lỗi thì phải có ít nhất một chỗ DỌN lỗi — nếu không, lỗi bám vĩnh viễn.
      expect(ma).toMatch(/setLoadError\(["']{2}\)/);
    },
  );
});
