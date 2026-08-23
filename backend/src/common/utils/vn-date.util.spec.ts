import { toVnDateOnly } from './vn-date.util';

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe('toVnDateOnly (BUG-009 — giữ đúng ngày lịch theo giờ Việt Nam)', () => {
  it('chuỗi chỉ có ngày giữ nguyên ngày', () => {
    expect(day(toVnDateOnly('1990-01-01'))).toBe('1990-01-01');
    expect(day(toVnDateOnly('2026-08-15'))).toBe('2026-08-15');
  });

  it('mốc thời gian kèm lệch giờ Việt Nam KHÔNG bị lùi một ngày', () => {
    // Đây chính là ca từng làm 01/01/2026 biến thành 31/12/2025.
    expect(day(toVnDateOnly('2026-01-01T00:00:00+07:00'))).toBe('2026-01-01');
    expect(day(toVnDateOnly('2026-01-01T23:59:59+07:00'))).toBe('2026-01-01');
  });

  it('mốc UTC được quy về ngày lịch mà người Việt Nam nhìn thấy', () => {
    // 23:00Z ngày 31/12 = 06:00 sáng 01/01 giờ Việt Nam.
    expect(day(toVnDateOnly('2025-12-31T23:00:00.000Z'))).toBe('2026-01-01');
    // 16:00Z ngày 31/12 = 23:00 tối 31/12 giờ Việt Nam.
    expect(day(toVnDateOnly('2025-12-31T16:00:00.000Z'))).toBe('2025-12-31');
  });

  it('luôn trả về đúng 00:00, không kèm phần giờ', () => {
    const d = toVnDateOnly('2026-08-15T13:45:12+07:00')!;
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });

  it('giá trị rỗng trả null, giá trị rác trả null (không bịa)', () => {
    expect(toVnDateOnly(null)).toBeNull();
    expect(toVnDateOnly(undefined)).toBeNull();
    expect(toVnDateOnly('')).toBeNull();
    expect(toVnDateOnly('hôm qua')).toBeNull();
  });

  it('nhận cả đối tượng Date', () => {
    expect(day(toVnDateOnly(new Date('2026-03-10T00:00:00.000Z')))).toBe('2026-03-10');
  });
});
