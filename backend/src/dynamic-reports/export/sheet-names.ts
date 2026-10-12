import { META_SHEET_NAME } from './meta-sheet';

/**
 * Names for the sheets of a manager's file: one copy of the report's sheets per
 * scope (the totals and every team). Excel limits a sheet name to 31 characters,
 * forbids `* ? : \ / [ ]`, treats names case-insensitively, and reserves a few.
 * So the names come from ONE table, built in a fixed order, and a name is never
 * produced twice; the table travels in the file's hidden metadata sheet.
 */

export const SHEET_NAME_MAX = 31;
const SEPARATOR = ' - ';

/** Names Excel (or this system) keeps for itself, compared in lower case. */
const RESERVED = new Set(['history', META_SHEET_NAME.toLowerCase()]);

export interface SheetScope {
  /** Stable id of the scope ('TOTAL', a team id). */
  scope: string;
  /** What the scope is called in a sheet name. */
  label: string;
}

/** The key of one (scope, original sheet) pair in the table. */
export function sheetNameKey(scope: string, sheet: string): string {
  return `${scope}\u0000${sheet}`;
}

function clean(text: string): string {
  return text
    .replace(/[*?:\\/[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^'+|'+$/g, '')
    .trim();
}

/** `label - sheet` within the limit: the longer part gives way, neither is dropped. */
function compose(labelPart: string, sheetPart: string | null): string {
  if (sheetPart === null) return labelPart.slice(0, SHEET_NAME_MAX);
  const budget = SHEET_NAME_MAX - SEPARATOR.length;
  let l = labelPart.length;
  let s = sheetPart.length;
  if (l + s > budget) {
    const half = Math.floor(budget / 2);
    if (l <= half) s = budget - l;
    else if (s <= budget - half) l = budget - s;
    else {
      l = budget - half;
      s = half;
    }
  }
  return `${labelPart.slice(0, l).trim()}${SEPARATOR}${sheetPart.slice(0, s).trim()}`;
}

/**
 * @param scopes in file order (totals first, then the teams)
 * @param sheets the report's sheets, in tab order
 * @returns key → exported name, in file order
 */
export function allocateSheetNames(
  scopes: readonly SheetScope[],
  sheets: readonly string[],
): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set<string>(RESERVED);
  const single = sheets.length === 1;

  for (const { scope, label } of scopes) {
    const labelPart = clean(label) || 'To';
    for (const sheet of sheets) {
      const base = (single ? compose(labelPart, null) : compose(labelPart, clean(sheet) || 'Sheet')) || 'Sheet';
      let name = base;
      for (let n = 2; taken.has(name.toLowerCase()); n++) {
        const suffix = ` (${n})`;
        name = `${base.slice(0, SHEET_NAME_MAX - suffix.length).trim()}${suffix}`;
      }
      taken.add(name.toLowerCase());
      out.set(sheetNameKey(scope, sheet), name);
    }
  }
  return out;
}
