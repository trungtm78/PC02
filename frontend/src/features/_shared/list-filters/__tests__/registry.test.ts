import { describe, it, expect } from 'vitest';
import { createListFilterRegistry, type FilterField } from '../registry';

interface CaseFilterValue {
  fromDate?: string;
  toDate?: string;
  unit?: string;
  investigator?: string;
}

describe('createListFilterRegistry', () => {
  it('returns empty fields when none registered', () => {
    const reg = createListFilterRegistry<CaseFilterValue>();
    expect(reg.all()).toEqual([]);
  });

  it('register adds a field', () => {
    const reg = createListFilterRegistry<CaseFilterValue>();
    const field: FilterField<CaseFilterValue> = {
      key: 'fromDate',
      label: 'Từ ngày',
      type: 'date',
      urlKey: 'fromDate',
      testid: 'filter-from-date',
    };
    reg.register(field);
    expect(reg.all()).toHaveLength(1);
    expect(reg.all()[0].key).toBe('fromDate');
  });

  it('registerMany preserves order', () => {
    const reg = createListFilterRegistry<CaseFilterValue>();
    reg.registerMany([
      { key: 'fromDate', label: 'A', type: 'date', urlKey: 'a', testid: 't1' },
      { key: 'toDate', label: 'B', type: 'date', urlKey: 'b', testid: 't2' },
      { key: 'unit', label: 'C', type: 'text', urlKey: 'c', testid: 't3' },
    ]);
    expect(reg.all().map((f) => f.key)).toEqual(['fromDate', 'toDate', 'unit']);
  });
});
