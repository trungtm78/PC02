import { describe, it, expect } from 'vitest';
import { soLieuHienThi, CHUA_BIET } from '../soLieuHienThi';

/**
 * Phép quyết định "được phép hiện con số này không", tách khỏi JSX để ca kiểm với tới.
 *
 * Sinh ra từ sự cố đo được 29/08/2026: màn Kiến nghị VKS khi tải hỏng hiện "Tổng số kiến nghị 0
 * · Chờ gửi 0 · Đã gửi 0" trong khi máy thật có 33 kiến nghị chờ gửi. Xem `soLieuHienThi.ts`.
 */
describe('soLieuHienThi', () => {
  it('tải bình thường thì hiện đúng con số', () => {
    expect(soLieuHienThi(33, false)).toBe('33');
    expect(soLieuHienThi(0, false)).toBe('0');
  });

  /** Rỗng THẬT vẫn phải hiện 0 — 0 là câu trả lời hợp lệ khi ta biết chắc. */
  it('rỗng thật thì vẫn là 0, không phải dấu gạch', () => {
    expect(soLieuHienThi(0, false)).toBe('0');
  });

  it('tải hỏng thì KHÔNG hiện số, kể cả khi có sẵn con số', () => {
    expect(soLieuHienThi(33, true)).toBe(CHUA_BIET);
    expect(soLieuHienThi(0, true)).toBe(CHUA_BIET);
  });

  /** Chưa có dữ liệu cũng là chưa biết — đừng dựng số 0 ra từ chỗ trống. */
  it.each([[null], [undefined], [NaN]])('%s thì là chưa biết', (v) => {
    expect(soLieuHienThi(v as number | null | undefined, false)).toBe(CHUA_BIET);
  });

  /** Dấu hiệu phải KHÁC số 0 — đó là toàn bộ lý do tồn tại của hàm này. */
  it('dấu hiệu chưa biết không phải là "0" hay chuỗi rỗng', () => {
    expect(CHUA_BIET).not.toBe('0');
    expect(CHUA_BIET.trim()).not.toBe('');
  });
});
