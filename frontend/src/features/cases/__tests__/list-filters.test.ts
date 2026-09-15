import { describe, it, expect } from 'vitest';
import { casesListFilters } from '../list-filters';

describe('casesListFilters registry', () => {
  it('registers 4 fields — ô lọc chữ theo cột đã thành thẻ tìm kiếm', () => {
    const keys = casesListFilters.all().map((f) => f.key);
    expect(keys).toEqual([
      'fromDate',
      'toDate',
      'createdById',
      // Ô "Tính theo" (25/08/2026): cán bộ đổi TẠM kỳ thống kê tính theo ngày tiếp nhận
      // hay ngày tạo; để trống thì theo cấu hình admin đặt trong Cài đặt hệ thống.
      'thongKeTruongNgay',
    ]);
  });

  it('khoá địa chỉ trang không trùng nhau', () => {
    const keys = casesListFilters.all().map((f) => f.urlKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('matches legacy testid pattern', () => {
    const testids = casesListFilters.all().map((f) => f.testid);
    expect(testids).toEqual([
      'filter-from-date',
      'filter-to-date',
      'filter-can-bo-nhap',
      'filter-tinh-theo',
    ]);
  });

  it('date fields are type=date', () => {
    const fromDate = casesListFilters.all().find((f) => f.key === 'fromDate')!;
    const toDate = casesListFilters.all().find((f) => f.key === 'toDate')!;
    expect(fromDate.type).toBe('date');
    expect(toDate.type).toBe('date');
  });

  /**
   * 15/09/2026: Đơn vị, Điều tra viên, Tội danh, STT, STT cũ là thẻ của ô tìm kiếm dạng thẻ. Để
   * lại ô chữ ở mặt lọc là hai lối vào một bộ lọc — tiền lệ #233 hai ô "Từ ngày" lệch nhau.
   */
  it('không còn ô lọc chữ nào trùng thẻ tìm kiếm', () => {
    const keys = casesListFilters.all().map((f) => f.key as string);
    for (const k of ['unit', 'investigator', 'charges', 'stt', 'sttCu']) {
      expect(keys).not.toContain(k);
    }
    expect(casesListFilters.all().filter((f) => f.type === 'text')).toEqual([]);
  });
});
