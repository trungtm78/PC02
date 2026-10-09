import { inferLabel } from './label';

/**
 * Label inference (spec §10 PR3 checklist: "gợi ý nhãn từ tiêu đề dòng/cột;
 * bắt buộc đặt tên khi không suy được"). HSLN's own layout is the model: col
 * A holds the long Vietnamese criteria text, col B a row code number, col C
 * the input cell — so walking left from an input cell, skip non-string
 * cells (numbers, blanks) until the nearest string is found. Returns null
 * when nothing is found so the caller can require an explicit label instead
 * of silently falling back to a cryptic address.
 */
describe('inferLabel', () => {
  function gridOf(row: Record<number, string | number | null>) {
    return (_row: number, col: number) => row[col] ?? null;
  }

  it('picks the nearest string cell to the left, skipping a number in between', () => {
    const getCellText = gridOf({
      1: 'Số tố giác, tin báo về tội phạm mới nhận',
      2: 1,
      3: 5,
    });
    expect(inferLabel(getCellText, 6, 3)).toBe(
      'Số tố giác, tin báo về tội phạm mới nhận',
    );
  });

  it('picks the immediately adjacent string cell when it is the first match', () => {
    const getCellText = gridOf({ 1: 'Tiêu chí', 2: 5 });
    expect(inferLabel(getCellText, 3, 2)).toBe('Tiêu chí');
  });

  it('returns null when no string cell exists anywhere to the left (column 1 is the field itself)', () => {
    const getCellText = gridOf({ 1: null });
    expect(inferLabel(getCellText, 1, 1)).toBeNull();
  });

  it('returns null when only numbers/blanks exist to the left', () => {
    const getCellText = gridOf({ 1: 7, 2: null, 3: 9 });
    expect(inferLabel(getCellText, 1, 4)).toBeNull();
  });

  it('ignores an empty-string cell (treats it the same as blank)', () => {
    const getCellText = gridOf({ 1: 'Thật', 2: '' });
    expect(inferLabel(getCellText, 1, 3)).toBe('Thật');
  });
});
