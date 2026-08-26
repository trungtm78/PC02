import { stripHtmlTags } from './sanitize.util';

describe('stripHtmlTags', () => {
  it('strips entire <script> block including its content', () => {
    expect(stripHtmlTags('<script>alert(1)</script>')).toBe('');
  });

  it('strips <img> onerror XSS payload', () => {
    expect(stripHtmlTags('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('strips <iframe> tag', () => {
    expect(stripHtmlTags('<iframe src="evil.com"></iframe>')).toBe('');
  });

  it('preserves normal Vietnamese text', () => {
    expect(stripHtmlTags('Nguyễn Văn An')).toBe('Nguyễn Văn An');
  });

  it('trims surrounding whitespace', () => {
    expect(stripHtmlTags('  hello  ')).toBe('hello');
  });

  /**
   * MỐC ĐÚNG ĐÃ ĐỔI 26/08/2026 — `null` và `undefined` mang HAI ý nghĩa khác hẳn nhau ở lớp
   * DTO, không được gộp làm một:
   *   - `undefined` = lời gọi KHÔNG NHẮC TỚI ô này → lớp dịch vụ giữ nguyên giá trị cũ.
   *   - `null`      = cán bộ đã XOÁ TRẮNG ô này    → lớp dịch vụ phải ghi NULL.
   *
   * Ca kiểm cũ chốt `null → undefined`, tức chốt đúng cái hợp đồng khiến thao tác xoá bị nuốt
   * ngay tại cổng vào: giao diện gửi đúng, máy chủ trả thành công, cột vẫn giữ giá trị cũ.
   * 30 trường của DTO Đơn thư đi qua hàm này.
   */
  it('giữ nguyên null, chỉ undefined mới ra undefined', () => {
    expect(stripHtmlTags(null)).toBeNull();
    expect(stripHtmlTags(undefined)).toBeUndefined();
  });

  it('returns non-string values as-is', () => {
    expect(stripHtmlTags(123 as any)).toBe(123);
  });
});
