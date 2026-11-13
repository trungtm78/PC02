import * as ExcelJS from 'exceljs';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';

/**
 * Criteria picked from an Excel file become a report.
 *
 * The author uploads any workbook and points at ONE column (all of it, or some of its cells): the text of each picked
 * cell is one criterion. From the list this module builds the workbook the rest of the system already understands
 * (a locked label next to an unlocked token cell per criterion), so entry, validation, aggregation and export are the
 * ones every report uses — there is no second pipeline.
 *
 * The browser only sends WHERE it picked (sheet, column, rows); the text is read again here from the file.
 */
export const CRITERIA_SHEET_NAME = 'Chỉ tiêu';

export const CRITERIA_LIMITS = {
  MAX_CRITERIA: 2_000,
  MAX_NAME_LENGTH: 500,
  MAX_SHORT_LENGTH: 60,
  MAX_SCAN_ROWS: 20_000,
} as const;

/** The token every criterion's value cell carries: a number that adds up across teams. */
const VALUE_TOKEN = '{NUM|#,##0.##|SUM}';
const ITEM_KEY = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const COLUMN = /^[A-Z]{1,3}$/;

export type CriterionOrigin = 'FILE' | 'MANUAL';
export type CriteriaHierarchy = 'NONE' | 'INDENT' | 'NUMBERING';

export interface CriteriaSelection {
  sheet: string;
  /** Column letter of the criteria text. */
  column: string;
  /** 1-based rows picked in that column; absent = the whole column. */
  rows?: number[] | null;
  codeColumn?: string | null;
  unitColumn?: string | null;
  hierarchy?: CriteriaHierarchy;
}

export interface Criterion {
  itemKey: string;
  code: string | null;
  name: string;
  unit: string | null;
  parentItemKey: string | null;
  origin: CriterionOrigin;
  /** The row of the uploaded file it was read from; null for a hand-typed one. */
  sourceRow: number | null;
}

export interface CriteriaWarning {
  code: 'BLANK_SKIPPED' | 'DUPLICATE_NAME' | 'NAME_TRUNCATED';
  row: number;
}

export type CriteriaErrorCode =
  | 'CRITERIA_SHEET_NOT_FOUND'
  | 'CRITERIA_COLUMN_INVALID'
  | 'CRITERIA_ROWS_INVALID'
  | 'CRITERIA_EMPTY'
  | 'CRITERIA_TOO_MANY'
  | 'CRITERIA_NAME_REQUIRED'
  | 'CRITERIA_KEY_INVALID'
  | 'CRITERIA_KEY_DUPLICATE'
  | 'CRITERIA_PARENT_UNKNOWN'
  | 'CRITERIA_PARENT_CYCLE';

/** A refusal the screen translates by its code. */
export class CriteriaError extends Error {
  constructor(
    public readonly code: CriteriaErrorCode,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(code);
  }
}

/** What a cell shows: plain text, the result of a formula, the runs of rich text, a number as text. */
function shown(cell: ExcelJS.Cell): string {
  const text = cell.text;
  return (typeof text === 'string' ? text : String(text ?? '')).replace(/\s+/g, ' ').trim();
}

/** Vietnamese text to a short ASCII key: "Số tin báo mới" -> "so-tin-bao-moi". */
function slug(text: string): string {
  const ascii = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii.slice(0, 60).replace(/-+$/g, '') || 'chi-tieu';
}

function uniqueKey(base: string, taken: Set<string>): string {
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;
  taken.add(key);
  return key;
}

const ROMAN = /^[IVXLCDM]+$/;

/** Depth of a numbering label: "I" -> 0, "1" -> 1, "1.2" -> 2 (when the list has roman headings; else one less). */
function numberingDepth(label: string, hasRoman: boolean): number | null {
  const cleaned = label.replace(/[.)]+$/, '').trim();
  if (!cleaned) return null;
  if (ROMAN.test(cleaned)) return 0;
  if (!/^\d+(\.\d+)*$/.test(cleaned)) return null;
  const segments = cleaned.split('.').length;
  return hasRoman ? segments : segments - 1;
}

/** Parent = the nearest row above with a smaller depth. */
function parentsFromDepths(depths: (number | null)[]): (number | null)[] {
  const stack: { depth: number; index: number }[] = [];
  return depths.map((depth, index) => {
    if (depth === null) return null;
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack.length ? stack[stack.length - 1].index : null;
    stack.push({ depth, index });
    return parent;
  });
}

export async function extractCriteria(
  buffer: Buffer,
  selection: CriteriaSelection,
): Promise<{ criteria: Criterion[]; warnings: CriteriaWarning[] }> {
  for (const column of [selection.column, selection.codeColumn, selection.unitColumn]) {
    if (column != null && !COLUMN.test(column)) throw new CriteriaError('CRITERIA_COLUMN_INVALID', { column });
  }
  const picked = selection.rows ?? null;
  if (picked && picked.some((r) => !Number.isInteger(r) || r < 1 || r > 1_048_576)) {
    throw new CriteriaError('CRITERIA_ROWS_INVALID');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.getWorksheet(selection.sheet);
  if (!sheet) throw new CriteriaError('CRITERIA_SHEET_NOT_FOUND', { sheet: selection.sheet });

  const lastRow = Math.min(sheet.rowCount, CRITERIA_LIMITS.MAX_SCAN_ROWS);
  const rows = picked
    ? [...new Set(picked)].sort((a, b) => a - b)
    : Array.from({ length: lastRow }, (_, i) => i + 1);

  const warnings: CriteriaWarning[] = [];
  const raw: { row: number; name: string; code: string | null; unit: string | null; indent: number }[] = [];
  for (const row of rows) {
    const cell = sheet.getCell(`${selection.column}${row}`);
    let name = shown(cell);
    if (!name) {
      // A blank in a whole-column pick is just an empty row; a blank the author picked on purpose is worth saying.
      if (picked) warnings.push({ code: 'BLANK_SKIPPED', row });
      continue;
    }
    if (name.length > CRITERIA_LIMITS.MAX_NAME_LENGTH) {
      name = name.slice(0, CRITERIA_LIMITS.MAX_NAME_LENGTH);
      warnings.push({ code: 'NAME_TRUNCATED', row });
    }
    const short = (column?: string | null) =>
      column ? shown(sheet.getCell(`${column}${row}`)).slice(0, CRITERIA_LIMITS.MAX_SHORT_LENGTH) || null : null;
    raw.push({
      row,
      name,
      code: short(selection.codeColumn),
      unit: short(selection.unitColumn),
      indent: cell.alignment?.indent ?? 0,
    });
    if (raw.length > CRITERIA_LIMITS.MAX_CRITERIA) {
      throw new CriteriaError('CRITERIA_TOO_MANY', { max: CRITERIA_LIMITS.MAX_CRITERIA });
    }
  }
  if (raw.length === 0) throw new CriteriaError('CRITERIA_EMPTY');

  const hierarchy = selection.hierarchy ?? 'NONE';
  let parents: (number | null)[] = raw.map(() => null);
  if (hierarchy === 'INDENT') {
    parents = parentsFromDepths(raw.map((r) => r.indent));
  } else if (hierarchy === 'NUMBERING') {
    // The numbering is in the code column when there is one, else at the start of the name ("1.1 Số vụ ...").
    const labels = raw.map((r) => r.code ?? /^([IVXLCDM]+|\d+(?:\.\d+)*)[.)]?\s/.exec(r.name)?.[1] ?? '');
    const hasRoman = labels.some((l) => ROMAN.test(l.replace(/[.)]+$/, '')));
    parents = parentsFromDepths(labels.map((l) => numberingDepth(l, hasRoman)));
  }

  const taken = new Set<string>();
  const seenNames = new Set<string>();
  const keys: string[] = [];
  const criteria = raw.map((r, i): Criterion => {
    const lower = r.name.toLowerCase();
    if (seenNames.has(lower)) warnings.push({ code: 'DUPLICATE_NAME', row: r.row });
    seenNames.add(lower);
    const itemKey = uniqueKey(slug(r.name), taken);
    keys.push(itemKey);
    const parent = parents[i];
    return {
      itemKey,
      code: r.code,
      name: r.name,
      unit: r.unit,
      parentItemKey: parent === null ? null : keys[parent],
      origin: 'FILE',
      sourceRow: r.row,
    };
  });
  return { criteria, warnings };
}

/** What the screen sends back after the author edited the list: every field optional but the name. */
export interface CriterionDraft {
  itemKey?: string | null;
  code?: string | null;
  name: string;
  unit?: string | null;
  parentItemKey?: string | null;
  origin?: CriterionOrigin;
  sourceRow?: number | null;
}

/** Validates an edited list and fills what is missing. Order is kept: it is the order of the rows. */
export function normaliseCriteria(drafts: readonly CriterionDraft[]): Criterion[] {
  if (!Array.isArray(drafts) || drafts.length === 0) throw new CriteriaError('CRITERIA_EMPTY');
  if (drafts.length > CRITERIA_LIMITS.MAX_CRITERIA) {
    throw new CriteriaError('CRITERIA_TOO_MANY', { max: CRITERIA_LIMITS.MAX_CRITERIA });
  }
  const text = (value: unknown, max: number) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

  const taken = new Set<string>();
  for (const [index, draft] of drafts.entries()) {
    if (draft.itemKey == null || draft.itemKey === '') continue;
    if (typeof draft.itemKey !== 'string' || !ITEM_KEY.test(draft.itemKey)) {
      throw new CriteriaError('CRITERIA_KEY_INVALID', { index });
    }
    if (taken.has(draft.itemKey)) throw new CriteriaError('CRITERIA_KEY_DUPLICATE', { index, itemKey: draft.itemKey });
    taken.add(draft.itemKey);
  }

  const criteria = drafts.map((draft, index): Criterion => {
    const name = text(draft.name, CRITERIA_LIMITS.MAX_NAME_LENGTH);
    if (!name) throw new CriteriaError('CRITERIA_NAME_REQUIRED', { index });
    return {
      itemKey: draft.itemKey || uniqueKey(slug(name), taken),
      code: text(draft.code, CRITERIA_LIMITS.MAX_SHORT_LENGTH) || null,
      name,
      unit: text(draft.unit, CRITERIA_LIMITS.MAX_SHORT_LENGTH) || null,
      parentItemKey: draft.parentItemKey || null,
      origin: draft.origin === 'MANUAL' ? 'MANUAL' : 'FILE',
      sourceRow: Number.isInteger(draft.sourceRow) ? (draft.sourceRow as number) : null,
    };
  });

  const byKey = new Map(criteria.map((c) => [c.itemKey, c]));
  for (const [index, c] of criteria.entries()) {
    if (c.parentItemKey === null) continue;
    if (!byKey.has(c.parentItemKey)) throw new CriteriaError('CRITERIA_PARENT_UNKNOWN', { index });
    // Walk up: reaching this criterion again (or running longer than the list) means the tree loops.
    let cursor: string | null = c.parentItemKey;
    for (let steps = 0; cursor !== null; steps += 1) {
      if (cursor === c.itemKey || steps > criteria.length) throw new CriteriaError('CRITERIA_PARENT_CYCLE', { index });
      cursor = byKey.get(cursor)?.parentItemKey ?? null;
    }
  }
  return criteria;
}

export interface CriteriaFieldRef {
  address: string;
  fieldKey: string;
  itemKey: string;
  unit: string | null;
  parentItemKey: string | null;
  origin: CriterionOrigin;
}

/**
 * The workbook for a list of criteria: Mã | Tiêu chí | Giá trị | ĐVT. The value sits right after the name so the
 * template parser, which labels an input by the nearest text to its left, labels it with the criterion. A criterion
 * with children is not typed: its value cell adds its direct children up.
 */
export async function buildCriteriaWorkbook(
  criteria: readonly Criterion[],
): Promise<{ buffer: Buffer; sheetName: string; fields: CriteriaFieldRef[] }> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(CRITERIA_SHEET_NAME);
  sheet.columns = [{ width: 10 }, { width: 60 }, { width: 18 }, { width: 12 }];
  sheet.addRow(['Mã', 'Tiêu chí', 'Giá trị', 'ĐVT']).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const rowOf = new Map(criteria.map((c, i) => [c.itemKey, i + 2]));
  const childrenOf = new Map<string, string[]>();
  const depthOf = new Map<string, number>();
  for (const c of criteria) {
    if (c.parentItemKey) childrenOf.set(c.parentItemKey, [...(childrenOf.get(c.parentItemKey) ?? []), c.itemKey]);
    depthOf.set(c.itemKey, c.parentItemKey ? (depthOf.get(c.parentItemKey) ?? 0) + 1 : 0);
  }

  const fields: CriteriaFieldRef[] = [];
  for (const c of criteria) {
    const row = rowOf.get(c.itemKey) as number;
    sheet.getCell(`A${row}`).value = escapeXlsxCell(c.code ?? '');
    const name = sheet.getCell(`B${row}`);
    name.value = escapeXlsxCell(c.name);
    name.alignment = { indent: depthOf.get(c.itemKey) ?? 0, wrapText: true, vertical: 'top' };
    sheet.getCell(`D${row}`).value = escapeXlsxCell(c.unit ?? '');

    const value = sheet.getCell(`C${row}`);
    const children = childrenOf.get(c.itemKey);
    if (children) {
      name.font = { bold: true };
      value.value = { formula: `SUM(${children.map((k) => `C${rowOf.get(k)}`).join(',')})` };
    } else {
      value.value = VALUE_TOKEN;
      value.protection = { locked: false };
      fields.push({
        address: `C${row}`,
        fieldKey: `${CRITERIA_SHEET_NAME}!C${row}`,
        itemKey: c.itemKey,
        unit: c.unit,
        parentItemKey: c.parentItemKey,
        origin: c.origin,
      });
    }
  }
  const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
  return { buffer, sheetName: CRITERIA_SHEET_NAME, fields };
}
