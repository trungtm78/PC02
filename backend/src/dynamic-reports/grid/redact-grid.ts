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
  const foreignRows = criteriaRows ? criteriaRowsOf(foreign, model) : [];

  const sheets = model.sheets.map((sheet): GridSheet => {
    const mine = bySheet.get(sheet.name);
    if (!mine) return sheet;
    const cells = { ...sheet.cells };
    if (!criteriaRows) {
      for (const f of mine) delete cells[f.address];
      return { ...sheet, cells };
    }
    const rows = new Set(foreignRows.filter((r) => r.sheetKey === sheet.name).map((r) => r.row));
    for (const address of Object.keys(cells)) {
      if (rows.has(rowOf(address))) delete cells[address];
    }
    // `hiddenRows` is 0-based; an A1 row number is 1-based.
    const hiddenRows = [...new Set([...sheet.hiddenRows, ...[...rows].map((r) => r - 1)])].sort((a, b) => a - b);
    return { ...sheet, cells, hiddenRows };
  });
  return { ...model, sheets };
}

const rowOf = (address: string) => Number(/\d+$/.exec(address)?.[0] ?? 0);

/**
 * The rows (1-based, as in an A1 address) the given fields stand on, each once, by sheet and then by row.
 *
 * In a workbook the system generated from a list of criteria one row is one criterion, so "the rows of the fields a
 * team was not given" is exactly what has to go, from the entry grid and from the team's own Excel file alike: both
 * ask here, so they cannot disagree about which rows those are.
 */
export function criteriaRowsOf(
  fields: readonly { sheetKey: string; address: string }[],
  /**
   * The grid of the workbook. Given, the answer also holds the GROUP HEADINGS the team has nothing under: a criterion
   * with children is a row that adds its children up and has no field of its own, so it is found by what its formula
   * reads. A heading goes when every row it adds up goes (a heading of headings by the same rule), and stays as soon
   * as the team has one criterion under it.
   */
  model?: Pick<GridModel, 'sheets'>,
): { sheetKey: string; row: number }[] {
  const bySheet = new Map<string, Set<number>>();
  for (const f of fields) bySheet.set(f.sheetKey, (bySheet.get(f.sheetKey) ?? new Set<number>()).add(rowOf(f.address)));
  for (const [sheetKey, rows] of bySheet) {
    const sheet = model?.sheets.find((s) => s.name === sheetKey);
    if (sheet) addEmptiedHeadings(sheet, rows);
  }
  return [...bySheet].flatMap(([sheetKey, rows]) => [...rows].sort((a, b) => a - b).map((row) => ({ sheetKey, row })));
}

/** The rows a formula of this sheet reads: single cells and both ends of a range with everything between them. */
function rowsRead(formula: string): number[] | null {
  // A reference into another sheet is not a child row of this list: such a formula is not a heading we can judge.
  if (formula.includes('!')) return null;
  const rows: number[] = [];
  for (const m of formula.matchAll(/\$?[A-Z]{1,3}\$?(\d+)(?::\$?[A-Z]{1,3}\$?(\d+))?/g)) {
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    for (let row = Math.min(from, to); row <= Math.max(from, to); row += 1) rows.push(row);
  }
  return rows;
}

/** Adds to `gone` every heading row whose formula reads only rows that are gone, until no more is found. */
function addEmptiedHeadings(sheet: Pick<GridSheet, 'cells'>, gone: Set<number>): void {
  const headings = Object.entries(sheet.cells).flatMap(([address, cell]) => {
    const reads = cell.k === 'formula' ? rowsRead(cell.f) : null;
    return reads && reads.length > 0 ? [{ row: rowOf(address), reads }] : [];
  });
  for (let found = true; found; ) {
    found = false;
    for (const heading of headings) {
      if (gone.has(heading.row) || !heading.reads.every((row) => gone.has(row))) continue;
      gone.add(heading.row);
      found = true;
    }
  }
}

/** A short tag of a scope, for the ETag: a browser must never reuse one team's grid for another scope. */
export function scopeTag(ownedFieldKeys: readonly string[]): string {
  return createHash('sha256')
    .update(JSON.stringify([...ownedFieldKeys].sort()))
    .digest('hex')
    .slice(0, 16);
}
