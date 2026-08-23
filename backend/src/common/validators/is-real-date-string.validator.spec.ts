import { IsRealDateStringConstraint } from './is-real-date-string.validator';

describe('IsRealDateStringConstraint (BUG-005 — chống nắn ngày)', () => {
  const c = new IsRealDateStringConstraint();

  it.each([
    ['1985-02-31', 'ngày 31 tháng 2 không tồn tại'],
    ['2026-04-31', 'tháng 4 chỉ có 30 ngày'],
    ['2025-02-29', '2025 không phải năm nhuận'],
    ['2026-13-01', 'không có tháng 13'],
    ['2026-00-10', 'không có tháng 0'],
    ['2026-05-00', 'không có ngày 0'],
  ])('từ chối %s (%s)', (value) => {
    expect(c.validate(value)).toBe(false);
  });

  it.each([
    ['1985-05-20'],
    ['2024-02-29'], // năm nhuận thật
    ['2026-01-01'],
    ['2026-12-31'],
    ['2026-08-15T00:00:00+07:00'],
    ['2026-08-15T10:30:00.000Z'],
  ])('chấp nhận %s', (value) => {
    expect(c.validate(value)).toBe(true);
  });

  it('bỏ qua giá trị trống (do @IsOptional đảm nhiệm)', () => {
    expect(c.validate(undefined)).toBe(true);
    expect(c.validate(null)).toBe(true);
    expect(c.validate('')).toBe(true);
  });

  it('từ chối giá trị không phải chuỗi và chuỗi rác', () => {
    expect(c.validate(12345)).toBe(false);
    expect(c.validate('hôm qua')).toBe(false);
  });

  it('thông điệp lỗi nêu rõ trường và giá trị để người dùng sửa được', () => {
    const msg = c.defaultMessage({ property: 'reporterDateOfBirth', value: '1985-02-31' } as never);
    expect(msg).toContain('reporterDateOfBirth');
    expect(msg).toContain('1985-02-31');
  });
});
