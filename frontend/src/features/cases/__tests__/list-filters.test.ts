import { describe, it, expect } from 'vitest';
import { casesListFilters } from '../list-filters';

describe('casesListFilters registry', () => {
  it('registers 8 fields — 5 gốc + 3 ô theo bảng lọc hệ cũ', () => {
    const keys = casesListFilters.all().map((f) => f.key);
    expect(keys).toEqual([
      'fromDate',
      'toDate',
      'unit',
      'investigator',
      'charges',
      'stt',
      'sttCu',
      'createdById',
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
      'filter-unit',
      'filter-investigator',
      'filter-charges',
      'filter-stt',
      'filter-stt-cu',
      'filter-can-bo-nhap',
    ]);
  });

  it('date fields are type=date', () => {
    const fromDate = casesListFilters.all().find((f) => f.key === 'fromDate')!;
    const toDate = casesListFilters.all().find((f) => f.key === 'toDate')!;
    expect(fromDate.type).toBe('date');
    expect(toDate.type).toBe('date');
  });

  it('text fields are type=text', () => {
    const text = ['unit', 'investigator', 'charges'];
    for (const k of text) {
      const f = casesListFilters.all().find((x) => x.key === k)!;
      expect(f.type).toBe('text');
    }
  });
});
