import { describe, it, expect } from 'vitest';
import { casesListFilters } from '../list-filters';

describe('casesListFilters registry', () => {
  it('registers 5 fields in order', () => {
    const keys = casesListFilters.all().map((f) => f.key);
    expect(keys).toEqual(['fromDate', 'toDate', 'unit', 'investigator', 'charges']);
  });

  it('matches legacy testid pattern', () => {
    const testids = casesListFilters.all().map((f) => f.testid);
    expect(testids).toEqual([
      'filter-from-date',
      'filter-to-date',
      'filter-unit',
      'filter-investigator',
      'filter-charges',
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
