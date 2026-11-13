import { createHash } from 'node:crypto';
import type { GridModel, GridSheet } from '../engine/grid-types';

/**
 * The grid an editor of ONE team may see.
 *
 * The grid model is built once per version and shared by everybody; a team that reports only some of the criteria
 * must not receive the others in it. This removes them from a copy before it is sent:
 * - in a workbook the system generated from a list of criteria, each criterion is one row, so the whole row of a
 *   criterion of another team is removed and the row hidden;
 * - in an ordinary template the labels are the author's own layout and cannot be attributed to a field, so only the
 *   input cell of another team is removed (it is then drawn as an empty, non-editable cell).
 *
 * The shared model is never changed; a sheet with nothing to remove is passed through as it is.
 */
export function redactGrid(
  model: GridModel,
  fields: readonly { sheetKey: string; address: string; fieldKey: string }[],
  ownedFieldKeys: readonly string[],
  criteriaRows: boolean,
): GridModel {
  const owned = new Set(ownedFieldKeys);
  const foreign = fields.filter((f) => !owned.has(f.fieldKey));
  if (foreign.length === 0) return model;

  const bySheet = new Map<string, typeof foreign>();
  for (const f of foreign) bySheet.set(f.sheetKey, [...(bySheet.get(f.sheetKey) ?? []), f]);

  const rowOf = (address: string) => Number(/\d+$/.exec(address)?.[0] ?? 0);
  const sheets = model.sheets.map((sheet): GridSheet => {
    const mine = bySheet.get(sheet.name);
    if (!mine) return sheet;
    const cells = { ...sheet.cells };
    if (!criteriaRows) {
      for (const f of mine) delete cells[f.address];
      return { ...sheet, cells };
    }
    const rows = new Set(mine.map((f) => rowOf(f.address)));
    for (const address of Object.keys(cells)) {
      if (rows.has(rowOf(address))) delete cells[address];
    }
    // `hiddenRows` is 0-based; an A1 row number is 1-based.
    const hiddenRows = [...new Set([...sheet.hiddenRows, ...[...rows].map((r) => r - 1)])].sort((a, b) => a - b);
    return { ...sheet, cells, hiddenRows };
  });
  return { ...model, sheets };
}

/** A short tag of a scope, for the ETag: a browser must never reuse one team's grid for another scope. */
export function scopeTag(ownedFieldKeys: readonly string[]): string {
  return createHash('sha256')
    .update(JSON.stringify([...ownedFieldKeys].sort()))
    .digest('hex')
    .slice(0, 16);
}
