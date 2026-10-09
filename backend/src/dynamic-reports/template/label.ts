/**
 * Label inference (spec §10 PR3 checklist). Walks left from an input
 * field's column, in the same row, skipping blank/number cells, until the
 * nearest non-empty string cell is found — that is almost always the
 * descriptive criteria text in real BCA templates (HSLN: col A is the
 * criteria text, col B a row-code number, col C the input cell). Returns
 * null when nothing is found; the caller must then require an explicit
 * label rather than falling back to a bare cell address.
 */
export type CellTextLookup = (
  row: number,
  col: number,
) => string | number | null;

export function inferLabel(
  getCellText: CellTextLookup,
  row: number,
  fieldCol: number,
): string | null {
  for (let col = fieldCol - 1; col >= 1; col--) {
    const value = getCellText(row, col);
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}
