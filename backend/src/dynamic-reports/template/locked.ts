/**
 * Effective-lock resolution (spec §10 R3). exceljs's `cell.style.protection`,
 * `row.style.protection`, and `column.style.protection` getters each reflect
 * ONLY the explicit xf that level's own style index declares — `undefined`
 * means "this level says nothing", not "unlocked is false". Excel's real
 * default when nothing in the chain declares protection is locked=true.
 */
export function resolveEffectiveLocked(
  cellLocked: boolean | undefined,
  rowLocked: boolean | undefined,
  columnLocked: boolean | undefined,
): boolean {
  if (cellLocked !== undefined) return cellLocked;
  if (rowLocked !== undefined) return rowLocked;
  if (columnLocked !== undefined) return columnLocked;
  return true;
}
