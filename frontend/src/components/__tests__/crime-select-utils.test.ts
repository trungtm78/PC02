import { describe, it, expect } from 'vitest';
import { visibleCrimes, type CrimeOption } from '../crime-select-utils';

const all: CrimeOption[] = [
  { id: 'a', code: 'D123', name: 'Tội giết người', pc02Relevant: true, articleNo: 123 },
  { id: 'b', code: 'D173', name: 'Tội trộm cắp tài sản', pc02Relevant: true, articleNo: 173 },
  { id: 'c', code: 'D251', name: 'Tội mua bán trái phép chất ma túy', pc02Relevant: false, articleNo: 251 },
  { id: 'd', code: 'D108', name: 'Tội phản bội Tổ quốc', pc02Relevant: false, articleNo: 108 },
];

describe('visibleCrimes', () => {
  it('mặc định (không search, không showAll) chỉ hiện PC02', () => {
    const r = visibleCrimes(all, { search: '', showAll: false });
    expect(r.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('showAll=true hiện tất cả, sắp theo articleNo', () => {
    const r = visibleCrimes(all, { search: '', showAll: true });
    expect(r.map((c) => c.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('search BỎ lọc PC02 — tìm cả tội ngoài PC02 (ma túy)', () => {
    const r = visibleCrimes(all, { search: 'ma túy', showAll: false });
    expect(r.map((c) => c.id)).toEqual(['c']);
  });

  it('search không dấu vẫn khớp (giet -> giết)', () => {
    const r = visibleCrimes(all, { search: 'giet', showAll: false });
    expect(r.map((c) => c.id)).toEqual(['a']);
  });

  it('search theo code', () => {
    const r = visibleCrimes(all, { search: 'D108', showAll: false });
    expect(r.map((c) => c.id)).toEqual(['d']);
  });

  it('search rỗng + showAll=false bỏ qua tội ngoài PC02', () => {
    const r = visibleCrimes(all, { search: '   ', showAll: false });
    expect(r.every((c) => c.pc02Relevant)).toBe(true);
  });
});
