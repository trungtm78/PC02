import { describe, it, expect } from 'vitest';
import { giaTriONgay } from '../gia-tri-o-ngay';

/**
 * `<input type="date">` chỉ nhận đúng `YYYY-MM-DD`. Mọi chuỗi khác là giá trị KHÔNG hợp lệ,
 * và hai engine xử lý khác nhau — đo trên máy 23/09/2026 bằng Playwright:
 *
 *   value="undefined"  →  Chromium đọc ra ""            (làm sạch theo đặc tả HTML)
 *                      →  WebKit   đọc ra "undefined"   (GIỮ NGUYÊN chuỗi rác)
 *
 * WebKit là engine của Safari. Nghĩa là trên máy macOS, một chuỗi hỏng lọt vào ô ngày sẽ
 * sống sót qua giao diện và ĐI LÊN MÁY CHỦ khi cán bộ bấm Lưu — trong khi trên Windows
 * cùng bản dựng ấy ô chỉ hiện rỗng, nên không ai thấy gì bất thường.
 *
 * Vì thế việc làm sạch KHÔNG được phó mặc cho trình duyệt. Nó phải xảy ra trước khi giá trị
 * chạm vào ô.
 */
describe('giaTriONgay — làm sạch giá trị trước khi vào <input type="date">', () => {
  it('giữ nguyên ngày đã đúng dạng', () => {
    expect(giaTriONgay('2021-03-15')).toBe('2021-03-15');
  });

  it('cắt dấu thời gian ISO về phần ngày, KHÔNG đổi ngày theo múi giờ', () => {
    // Cắt tiền tố chứ không đi qua `new Date`: một giá trị ngày trần mà quy đổi múi giờ thì
    // 15/03 thành 16/03 ở một nửa số trường hợp. Panel anh em (LegacyParityFields) đã cắt
    // tiền tố từ đầu; hai panel phải cho CÙNG một kết quả, nếu không cùng một hồ sơ đọc ở
    // hai chỗ sẽ ra hai ngày.
    expect(giaTriONgay('2021-03-15T00:00:00.000Z')).toBe('2021-03-15');
    expect(giaTriONgay('2021-03-15T23:59:59.000Z')).toBe('2021-03-15');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['chuỗi rỗng', ''],
    ['chuỗi trắng', '   '],
  ])('%s → chuỗi rỗng', (_ten, v) => {
    expect(giaTriONgay(v)).toBe('');
  });

  it.each([
    ['chữ "undefined" lọt từ String(undefined)', 'undefined'],
    ['chữ "null" lọt từ String(null)', 'null'],
    ['chữ "NaN"', 'NaN'],
    ['ngày kiểu Việt Nam', '15/03/2021'],
    ['chữ tự do của hệ cũ', 'Không ghi ngày'],
    ['năm không đủ 4 chữ số', '221-03-15'],
  ])('%s → chuỗi rỗng, KHÔNG để lọt sang Safari', (_ten, v) => {
    expect(giaTriONgay(v)).toBe('');
  });

  it('đối tượng Date cũng ra đúng dạng ô ngày', () => {
    expect(giaTriONgay(new Date(Date.UTC(2021, 2, 15)))).toBe('2021-03-15');
  });

  it.each([
    ['tháng 13', '2021-13-01'],
    ['ngày 32', '2021-01-32'],
    ['30 tháng 2', '2021-02-30'],
  ])('%s — đúng DẠNG nhưng không có thật trên lịch → chuỗi rỗng', (_ten, v) => {
    // Chỉ khớp dạng là chưa đủ: `2021-02-30` qua được biểu thức nhưng vẫn là giá trị KHÔNG
    // hợp lệ với `<input type="date">`, nên Safari lại giữ nguyên nó y như chuỗi rác.
    expect(giaTriONgay(v)).toBe('');
  });

  it.each([
    ['năm 0000', '0000-01-01'],
    ['năm 0000 tháng khác', '0000-12-31'],
  ])('%s — đặc tả HTML đòi năm >= 1, phải trả rỗng', (_ten, v) => {
    // Cổng engine bắt được 24/09/2026, ca kiểm jsdom thì không: hàm cho `0000-01-01` đi qua,
    // nhưng Chromium TỪ CHỐI (ô về rỗng) còn WebKit GIỮ NGUYÊN. Tức hàm sinh ra chuỗi mà
    // trình duyệt không nuốt — đúng lớp lỗi chỉ đo được trên trình duyệt thật.
    expect(giaTriONgay(v)).toBe('');
  });

  it('năm 0001 là biên DƯỚI hợp lệ, không được chặn nhầm', () => {
    expect(giaTriONgay('0001-01-01')).toBe('0001-01-01');
  });

  // ─── Ba lỗi Codex bắt được 23/09/2026 trong chính bản vá này ───────────────────
  /** Năm 0 KHÔNG dựng được bằng `Date.UTC(0, …)` — hàm ấy đổi 0-99 thành 1900-1999. */
  const namNgoaiDai = (nam: number): Date => {
    const d = new Date(Date.UTC(2000, 0, 1));
    d.setUTCFullYear(nam);
    return d;
  };

  it.each([
    ['năm 10000', 10000],
    ['năm 0', 0],
  ])('%s — nhánh Date cũng phải qua phép kiểm, không cắt cụt chuỗi ISO mở rộng', (_ten, nam) => {
    // `toISOString()` của năm ngoài [1000..9999] ra dạng MỞ RỘNG: "+010000-01-01T…".
    // Cắt 10 ký tự đầu cho ra "+010000-01" — một chuỗi rác lọt thẳng vào ô ngày, tức đúng
    // thứ hàm này sinh ra để chặn.
    expect(giaTriONgay(namNgoaiDai(nam))).toBe('');
  });

  it.each([
    ['năm 0099', '0099-01-01'],
    ['năm 0001', '0001-12-31'],
    ['năm 0096 nhuận thật (96 chia hết 4)', '0096-02-29'],
  ])('%s — năm hai chữ số vẫn là ngày có thật, KHÔNG được chặn', (_ten, v) => {
    // `Date.UTC(99, 0, 1)` trả về năm 1999, không phải 99 — luật tương thích ngược của
    // JavaScript. Dùng nó để kiểm lịch thì mọi năm 1–99 bị coi là sai lịch và bị xoá trắng.
    expect(giaTriONgay(v)).toBe(v);
  });

  it('số và đối tượng lạ KHÔNG được biến thành ngày bịa', () => {
    expect(giaTriONgay(0)).toBe('');
    expect(giaTriONgay({})).toBe('');
    expect(giaTriONgay([])).toBe('');
  });
});
