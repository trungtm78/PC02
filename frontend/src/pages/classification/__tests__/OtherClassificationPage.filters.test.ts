/**
 * Filters on this screen that could never match anything.
 *
 * - The date range compared `reportedDate` (dd/MM/yyyy, formatted for display)
 *   against an `<input type="date">` value (yyyy-MM-dd) with `<`. Comparing
 *   two formats as strings is nonsense: "10/08/2026" sorts before "2026-08-01"
 *   because '1' < '2', so a start date removed every row and an end date
 *   removed none.
 * - `ward` was hardcoded to "" on every row while the dropdown offered three
 *   invented wards. The real value lives on `subjects.wardId` and has to be
 *   filtered server-side, so the control is gone (ND-25) rather than left
 *   looking usable.
 * - `category` options were a fixed list of a different taxonomy while the
 *   field was mapped from `crime`.
 *
 * These import the page's own functions. An earlier version reimplemented the
 * rules here, which meant reverting the page would have left every test green.
 */
import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  deriveCategories,
  type FilterData,
  type OtherCase,
} from '../otherClassificationFilters';

const EMPTY: FilterData = {
  quickSearch: '',
  fromDate: '',
  toDate: '',
  district: '',
  status: '',
  category: '',
};

function row(over: Partial<OtherCase> = {}): OtherCase {
  return {
    id: 'c1',
    stt: 1,
    caseName: 'Vụ án A',
    type: 'Trộm cắp',
    district: 'Quận 1',
    reportedBy: 'Nguyễn Văn B',
    reportedDate: '10/08/2026',
    reportedDateISO: '2026-08-10',
    status: 'pending',
    statusLabel: 'Tiếp nhận',
    category: 'Trộm cắp',
    ...over,
  };
}

describe('applyFilters — date range', () => {
  it('keeps a row inside the range', () => {
    expect(
      applyFilters([row()], {
        ...EMPTY,
        fromDate: '2026-08-01',
        toDate: '2026-08-31',
      }),
    ).toHaveLength(1);
  });

  it('drops a row before the start', () => {
    expect(
      applyFilters([row()], { ...EMPTY, fromDate: '2026-09-01' }),
    ).toHaveLength(0);
  });

  it('drops a row after the end', () => {
    expect(
      applyFilters([row()], { ...EMPTY, toDate: '2026-08-09' }),
    ).toHaveLength(0);
  });

  it('compares the ISO field, not the displayed dd/MM/yyyy', () => {
    // The regression in one assertion: a row whose display string sorts
    // "before" the bound is still kept, because the comparison no longer
    // touches that string.
    const r = row({ reportedDate: '10/08/2026', reportedDateISO: '2026-08-10' });
    expect(applyFilters([r], { ...EMPTY, fromDate: '2026-08-01' })).toHaveLength(
      1,
    );
  });

  it('an empty bound does not filter', () => {
    expect(applyFilters([row()], EMPTY)).toHaveLength(1);
  });

  it('a row with no usable date is excluded once a lower bound is set', () => {
    expect(
      applyFilters([row({ reportedDateISO: '' })], {
        ...EMPTY,
        fromDate: '2026-01-01',
      }),
    ).toHaveLength(0);
  });
});

describe('applyFilters — search and exact matches', () => {
  it('searches the case name and the type', () => {
    const rows = [row({ caseName: 'Vụ án A' }), row({ id: 'c2', stt: 2, caseName: 'Vụ án B' })];
    expect(applyFilters(rows, { ...EMPTY, quickSearch: 'án b' })).toHaveLength(1);
  });

  it('filters by district, status and category exactly', () => {
    const rows = [row(), row({ id: 'c2', stt: 2, district: 'Quận 3' })];
    expect(applyFilters(rows, { ...EMPTY, district: 'Quận 3' })).toHaveLength(1);
    expect(applyFilters(rows, { ...EMPTY, status: 'resolved' })).toHaveLength(0);
    expect(applyFilters(rows, { ...EMPTY, category: 'Trộm cắp' })).toHaveLength(
      2,
    );
  });
});

describe('deriveCategories', () => {
  it('offers exactly what the data contains, deduplicated and sorted', () => {
    expect(
      deriveCategories([
        { category: 'Trộm cắp tài sản' },
        { category: 'Cố ý gây thương tích' },
        { category: 'Trộm cắp tài sản' },
      ]),
    ).toEqual(['Cố ý gây thương tích', 'Trộm cắp tài sản']);
  });

  it('drops empty values rather than offering a blank option', () => {
    expect(deriveCategories([{ category: '' }, { category: 'Khác' }])).toEqual([
      'Khác',
    ]);
  });

  it('is empty when there are no rows', () => {
    expect(deriveCategories([])).toEqual([]);
  });
});
