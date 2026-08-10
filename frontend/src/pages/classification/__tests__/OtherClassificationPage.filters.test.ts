/**
 * Three filters on this screen could never match anything.
 *
 * - The date range compared `reportedDate` (dd/MM/yyyy, formatted for
 *   display) against an `<input type="date">` value (yyyy-MM-dd) with `<`.
 *   String comparison across two formats is nonsense: "10/08/2026" sorts
 *   before "2026-08-01" because '1' < '2'.
 * - `ward` was hardcoded to "" on every row, so the ward filter and the ward
 *   half of the search matched nothing, ever.
 * - `category` options were a fixed list of a different taxonomy entirely
 *   ("Vụ án hình sự", "Đơn thư khiếu nại") while the field itself was mapped
 *   from `crime`.
 *
 * These test the comparison rules directly; the page wiring is covered by
 * typecheck plus the page's own render tests.
 */
import { describe, it, expect } from 'vitest';

/** The comparison the page performs, extracted to be assertable. */
function inRange(iso: string, from: string, to: string): boolean {
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

/** What the old code compared. */
function inRangeOld(display: string, from: string, to: string): boolean {
  if (from && display < from) return false;
  if (to && display > to) return false;
  return true;
}

describe('date range filter', () => {
  const iso = '2026-08-10';
  const display = '10/08/2026';

  it('keeps a row inside the range', () => {
    expect(inRange(iso, '2026-08-01', '2026-08-31')).toBe(true);
  });

  it('drops a row before the start', () => {
    expect(inRange(iso, '2026-09-01', '')).toBe(false);
  });

  it('drops a row after the end', () => {
    expect(inRange(iso, '', '2026-08-09')).toBe(false);
  });

  it('the old comparison got the same case wrong', () => {
    // Regression anchor: the display format sorts before any yyyy-… bound,
    // so "from" excluded everything and "to" excluded nothing.
    expect(inRangeOld(display, '2026-08-01', '')).toBe(false);
    expect(inRangeOld(display, '', '2026-08-09')).toBe(true);
  });

  it('an empty bound does not filter', () => {
    expect(inRange(iso, '', '')).toBe(true);
  });

  it('a row with no date is excluded once a lower bound is set', () => {
    expect(inRange('', '2026-01-01', '')).toBe(false);
  });
});

describe('category options derived from the rows', () => {
  function categoriesOf(rows: { category: string }[]): string[] {
    return [...new Set(rows.map((r) => r.category).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'vi'),
    );
  }

  it('offers exactly what the data contains, deduplicated and sorted', () => {
    expect(
      categoriesOf([
        { category: 'Trộm cắp tài sản' },
        { category: 'Cố ý gây thương tích' },
        { category: 'Trộm cắp tài sản' },
      ]),
    ).toEqual(['Cố ý gây thương tích', 'Trộm cắp tài sản']);
  });

  it('drops empty values rather than offering a blank option', () => {
    expect(categoriesOf([{ category: '' }, { category: 'Khác' }])).toEqual([
      'Khác',
    ]);
  });

  it('is empty when there are no rows, so the control shows nothing to pick', () => {
    expect(categoriesOf([])).toEqual([]);
  });
});
