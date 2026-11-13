/**
 * Pure rules of "criteria picked from an Excel file": what a pick on the grid means, how the reviewed list is edited,
 * how a team's ticks become the `itemKeys` of the save payload. No React, no network: every rule here has a unit test.
 */
import type { GridSheet } from '../engine/generated/grid-types';
import type {
  CriteriaFieldRef,
  CriteriaWarning,
  Criterion,
  CriterionDraft,
  CriterionOrigin,
  ParsedField,
  ReportTargetConfig,
} from '../types';

// ── Addresses ────────────────────────────────────────────────────────────────

/** 0-based column index to Excel letters: 0 -> "A", 26 -> "AA". */
export function columnLetters(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** "AB12" -> { column: "AB", row: 12 }; null when the text is not an A1 address. */
export function splitAddress(address: string): { column: string; row: number } | null {
  const m = /^([A-Z]{1,3})([1-9]\d*)$/.exec(address);
  return m ? { column: m[1], row: Number(m[2]) } : null;
}

/** A column typed by hand: trimmed, upper-cased; null unless it is one to three letters. */
export function normaliseColumn(text: string): string | null {
  const column = text.trim().toUpperCase();
  return /^[A-Z]{1,3}$/.test(column) ? column : null;
}

/** The letters of every column of a sheet, in order. */
export function sheetColumns(sheet: Pick<GridSheet, 'cols'>): string[] {
  return Array.from({ length: sheet.cols }, (_, i) => columnLetters(i));
}

/** The cells a criterion can be read from: text or a number, not blank. Addresses on that sheet. */
export function candidateAddresses(sheet: Pick<GridSheet, 'cells'>): string[] {
  const out: string[] = [];
  for (const [address, cell] of Object.entries(sheet.cells)) {
    if ((cell.k === 'text' || cell.k === 'num') && cell.v.trim() !== '') out.push(address);
  }
  return out;
}

// ── Picking one column, or some cells of one column ──────────────────────────

/** What the author picked: one column, all of it (`rows` null) or some of its rows (1-based, ascending). */
export interface ColumnSelection {
  column: string;
  rows: number[] | null;
}

export function selectWholeColumn(column: string): ColumnSelection {
  return { column, rows: null };
}

export interface CellPickOutcome {
  selection: ColumnSelection | null;
  /** True when the pick moved to another column and the cells picked before were dropped. */
  switched: boolean;
}

/**
 * A click or a drag on the grid ended over these cells (addresses of ONE sheet, row-major).
 *
 * Every picked cell must be in the same column. A drag over several columns keeps the column already chosen when it
 * touches it, else the column of its first cell. A pick in another column switches to that column and drops the
 * earlier cells — the caller says so on screen.
 *
 * `additive` (Ctrl/⌘): adds to the rows already picked; picking only rows that are all picked already removes them.
 */
export function applyCellPick(
  current: ColumnSelection | null,
  addresses: readonly string[],
  additive: boolean,
): CellPickOutcome {
  const cells = addresses.map(splitAddress).filter((c): c is { column: string; row: number } => c !== null);
  if (cells.length === 0) {
    return { selection: additive ? current : null, switched: false };
  }
  const column = current && cells.some((c) => c.column === current.column) ? current.column : cells[0].column;
  const rows = sortedUnique(cells.filter((c) => c.column === column).map((c) => c.row));

  if (!current || current.column !== column) {
    return { selection: { column, rows }, switched: current !== null };
  }
  if (!additive) return { selection: { column, rows }, switched: false };
  // Adding to a whole column changes nothing: every row is in it already.
  if (current.rows === null) return { selection: current, switched: false };
  const had = new Set(current.rows);
  if (rows.every((r) => had.has(r))) {
    const left = current.rows.filter((r) => !rows.includes(r));
    return { selection: left.length > 0 ? { column, rows: left } : null, switched: false };
  }
  return { selection: { column, rows: sortedUnique([...current.rows, ...rows]) }, switched: false };
}

function sortedUnique(rows: readonly number[]): number[] {
  return [...new Set(rows)].sort((a, b) => a - b);
}

/** The picked cells among the candidates of a sheet, as "Sheet!A1" (what the grid shades). */
export function chosenKeys(
  sheetName: string,
  selection: ColumnSelection | null,
  candidates: readonly string[],
): Set<string> {
  const out = new Set<string>();
  if (!selection) return out;
  const rows = selection.rows ? new Set(selection.rows) : null;
  for (const address of candidates) {
    const cell = splitAddress(address);
    if (!cell || cell.column !== selection.column) continue;
    if (rows === null || rows.has(cell.row)) out.add(`${sheetName}!${address}`);
  }
  return out;
}

/** Rows typed as "from … to" when the sheet cannot be drawn. Both blank = the whole column; null = not a range. */
export function rowsFromRange(fromText: string, toText: string): { rows: number[] | null } | null {
  const from = fromText.trim();
  const to = toText.trim();
  if (from === '' && to === '') return { rows: null };
  if (!/^\d+$/.test(from) || !/^\d+$/.test(to)) return null;
  const a = Number(from);
  const b = Number(to);
  if (a < 1 || b < a || b - a >= MAX_TYPED_ROWS) return null;
  return { rows: Array.from({ length: b - a + 1 }, (_, i) => a + i) };
}

/** The server scans at most this many rows of a column; a longer typed range can only be a slip. */
export const MAX_TYPED_ROWS = 20_000;

// ── The reviewed list ────────────────────────────────────────────────────────

/** Vietnamese text to the short ASCII key the server would make of it: "Số tin báo mới" -> "so-tin-bao-moi". */
export function slugKey(text: string): string {
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

function uniqueKey(base: string, taken: ReadonlySet<string>): string {
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;
  return key;
}

/** How deep each criterion sits under its parents (0 = top). A parent that is missing or loops counts as none. */
export function depthsOf(criteria: readonly Criterion[]): Map<string, number> {
  const byKey = new Map(criteria.map((c) => [c.itemKey, c]));
  const out = new Map<string, number>();
  for (const c of criteria) {
    let depth = 0;
    let cursor = c.parentItemKey;
    const seen = new Set([c.itemKey]);
    while (cursor !== null && byKey.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      depth += 1;
      cursor = byKey.get(cursor)?.parentItemKey ?? null;
    }
    out.set(c.itemKey, depth);
  }
  return out;
}

/** The criteria that have children: nobody types them, their figure is the sum of their children. */
export function parentKeysOf(criteria: readonly Criterion[]): Set<string> {
  const keys = new Set(criteria.map((c) => c.itemKey));
  const out = new Set<string>();
  for (const c of criteria) {
    if (c.parentItemKey !== null && keys.has(c.parentItemKey)) out.add(c.parentItemKey);
  }
  return out;
}

export function updateCriterion(
  criteria: readonly Criterion[],
  itemKey: string,
  patch: Partial<Pick<Criterion, 'name' | 'unit'>>,
): Criterion[] {
  return criteria.map((c) => (c.itemKey === itemKey ? { ...c, ...patch } : c));
}

/** Removes one criterion; its children move up to its own parent, so no child is left pointing at nothing. */
export function removeCriterion(criteria: readonly Criterion[], itemKey: string): Criterion[] {
  const gone = criteria.find((c) => c.itemKey === itemKey);
  if (!gone) return [...criteria];
  return criteria
    .filter((c) => c.itemKey !== itemKey)
    .map((c) => (c.parentItemKey === itemKey ? { ...c, parentItemKey: gone.parentItemKey } : c));
}

export interface ManualCriterionInput {
  name: string;
  unit?: string;
  parentItemKey?: string | null;
}

/**
 * Adds a hand-typed criterion (origin MANUAL). It gets its key here, so that a criterion typed next can name it as
 * its parent. With a parent it is placed after that parent's last descendant, else at the end: the list order is
 * the row order of the workbook. Returns the list unchanged when the name is blank.
 */
export function addManualCriterion(criteria: readonly Criterion[], input: ManualCriterionInput): Criterion[] {
  const name = input.name.replace(/\s+/g, ' ').trim();
  if (!name) return [...criteria];
  const taken = new Set(criteria.map((c) => c.itemKey));
  const parentItemKey = input.parentItemKey && taken.has(input.parentItemKey) ? input.parentItemKey : null;
  const added: Criterion = {
    itemKey: uniqueKey(slugKey(name), taken),
    code: null,
    name,
    unit: input.unit?.replace(/\s+/g, ' ').trim() || null,
    parentItemKey,
    origin: 'MANUAL',
    sourceRow: null,
  };
  if (parentItemKey === null) return [...criteria, added];

  const depths = depthsOf(criteria);
  const parentIndex = criteria.findIndex((c) => c.itemKey === parentItemKey);
  const parentDepth = depths.get(parentItemKey) ?? 0;
  let insertAt = parentIndex + 1;
  while (insertAt < criteria.length && (depths.get(criteria[insertAt].itemKey) ?? 0) > parentDepth) insertAt += 1;
  return [...criteria.slice(0, insertAt), added, ...criteria.slice(insertAt)];
}

/** The list as the workbook endpoint takes it: nulls left out, blank text left out. */
export function toDrafts(criteria: readonly Criterion[]): CriterionDraft[] {
  return criteria.map((c) => ({
    itemKey: c.itemKey,
    ...(c.code ? { code: c.code } : {}),
    name: c.name.trim(),
    ...(c.unit && c.unit.trim() ? { unit: c.unit.trim() } : {}),
    ...(c.parentItemKey ? { parentItemKey: c.parentItemKey } : {}),
    origin: c.origin,
    ...(c.sourceRow !== null ? { sourceRow: c.sourceRow } : {}),
  }));
}

/** Warnings about a criterion, by the row it was read from; blank cells have no criterion and are listed apart. */
export function splitWarnings(warnings: readonly CriteriaWarning[]): {
  byRow: Map<number, CriteriaWarning['code'][]>;
  blankRows: number[];
} {
  const byRow = new Map<number, CriteriaWarning['code'][]>();
  const blankRows: number[] = [];
  for (const w of warnings) {
    if (w.code === 'BLANK_SKIPPED') {
      blankRows.push(w.row);
      continue;
    }
    byRow.set(w.row, [...(byRow.get(w.row) ?? []), w.code]);
  }
  return { byRow, blankRows };
}

// ── From the generated workbook to the wizard ────────────────────────────────

/** The xlsx the server sent as base64, as the File the wizard would have got from a file input. */
export function fileFromBase64(base64: string, fileName: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** What the wizard remembers of a criteria report between "use this list" and saving. */
export interface CriteriaMeta {
  criteria: Criterion[];
  fields: CriteriaFieldRef[];
}

/** Each field of the preview gets the criterion it stands for (matched by field key). Others are left as they are. */
export function withCriteriaMeta<F extends ParsedField>(fields: readonly F[], meta: CriteriaMeta | null): F[] {
  if (!meta) return [...fields];
  const byFieldKey = new Map(meta.fields.map((f) => [f.fieldKey, f]));
  return fields.map((f) => {
    const ref = byFieldKey.get(f.fieldKey);
    if (!ref) return f;
    return {
      ...f,
      itemKey: ref.itemKey,
      ...(ref.unit ? { unit: ref.unit } : {}),
      ...(ref.parentItemKey ? { parentItemKey: ref.parentItemKey } : {}),
      origin: ref.origin,
    };
  });
}

// ── What a team reports ──────────────────────────────────────────────────────

/** One thing a team can be asked to report: a criterion, or an input cell of an ordinary template. */
export interface ReportableItem {
  /** The key a subset names it by: the field's item key, or its field key when it has none. */
  key: string;
  label: string;
  unit: string | null;
  parentKey: string | null;
}

/** Items under one parent criterion. `key` null = items with no parent (and every item of a template report). */
export interface ItemGroup {
  key: string | null;
  label: string | null;
  items: ReportableItem[];
}

/**
 * What a checklist needs of an input cell. Both a field of the wizard's preview and a field of a saved version
 * (where "none" is null instead of absent) fit.
 */
export interface ItemSourceField {
  fieldKey: string;
  label: string;
  itemKey?: string | null;
  unit?: string | null;
  parentItemKey?: string | null;
}

/** The key the server names a field by in a team's subset. */
export function itemKeyOfField(field: Pick<ItemSourceField, 'fieldKey' | 'itemKey'>): string {
  return field.itemKey ?? field.fieldKey;
}

/** The reportable items of a report, in the order of its fields. */
export function reportableItems(fields: readonly ItemSourceField[], criteria?: readonly Criterion[] | null): ReportableItem[] {
  const names = new Map((criteria ?? []).map((c) => [c.itemKey, c.name]));
  return fields.map((f) => ({
    key: itemKeyOfField(f),
    label: (f.itemKey ? names.get(f.itemKey) : undefined) || f.label || f.fieldKey,
    unit: f.unit ?? null,
    parentKey: f.parentItemKey ?? null,
  }));
}

/**
 * Items grouped under their direct parent, groups in the order their first item appears. A group is named by the
 * whole path of its parents ("I. Tội phạm › 1. Trộm cắp"), so a deep tree still reads as a flat list of groups.
 */
export function groupItems(items: readonly ReportableItem[], criteria?: readonly Criterion[] | null): ItemGroup[] {
  const byKey = new Map((criteria ?? []).map((c) => [c.itemKey, c]));
  const pathOf = (key: string): string => {
    const names: string[] = [];
    let cursor: string | null = key;
    for (let steps = 0; cursor !== null && steps <= byKey.size; steps += 1) {
      const c = byKey.get(cursor);
      if (!c) break;
      names.unshift(c.name);
      cursor = c.parentItemKey;
    }
    return names.join(' › ') || key;
  };
  const groups = new Map<string | null, ItemGroup>();
  for (const item of items) {
    const groupKey = item.parentKey;
    let group = groups.get(groupKey);
    if (!group) {
      group = { key: groupKey, label: groupKey === null ? null : pathOf(groupKey), items: [] };
      groups.set(groupKey, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}

/** Lower case, no accents: "Số vụ" matches "so vu". */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** The groups with only the items whose label, unit or group name holds the query; empty groups are dropped. */
export function filterGroups(groups: readonly ItemGroup[], query: string): ItemGroup[] {
  const q = foldText(query);
  if (!q) return [...groups];
  return groups
    .map((g) => {
      const groupHit = g.label !== null && foldText(g.label).includes(q);
      const items = groupHit
        ? g.items
        : g.items.filter((i) => foldText(i.label).includes(q) || (i.unit !== null && foldText(i.unit).includes(q)));
      return { ...g, items };
    })
    .filter((g) => g.items.length > 0);
}

export function tickAll(ticked: ReadonlySet<string>, keys: readonly string[]): Set<string> {
  return new Set([...ticked, ...keys]);
}

export function untickAll(ticked: ReadonlySet<string>, keys: readonly string[]): Set<string> {
  const out = new Set(ticked);
  for (const k of keys) out.delete(k);
  return out;
}

/** Among `keys`: what was ticked is cleared, what was clear is ticked. Ticks outside `keys` are kept. */
export function invertTicks(ticked: ReadonlySet<string>, keys: readonly string[]): Set<string> {
  const out = new Set(ticked);
  for (const k of keys) {
    if (out.has(k)) out.delete(k);
    else out.add(k);
  }
  return out;
}

export function toggleTick(ticked: ReadonlySet<string>, key: string): Set<string> {
  return invertTicks(ticked, [key]);
}

/** A group's own box: 'all' ticked, 'none', or 'some' (drawn as indeterminate). */
export function groupState(ticked: ReadonlySet<string>, group: ItemGroup): 'all' | 'some' | 'none' {
  const n = group.items.filter((i) => ticked.has(i.key)).length;
  if (n === 0) return 'none';
  return n === group.items.length ? 'all' : 'some';
}

/**
 * A team's ticks when its section opens: everything when it has no subset; else its subset, minus keys the report
 * no longer has (the author went back and changed the list).
 */
export function ticksFromTarget(itemKeys: readonly string[] | null | undefined, allKeys: readonly string[]): Set<string> {
  if (itemKeys === null || itemKeys === undefined) return new Set(allKeys);
  const wanted = new Set(itemKeys);
  return new Set(allKeys.filter((k) => wanted.has(k)));
}

/**
 * A team's ticks as the save payload carries them: left out (undefined) when everything is ticked, so a criterion
 * added by a later version is the team's too; else the ticked keys in the order of the report's fields.
 */
export function itemKeysForPayload(ticked: ReadonlySet<string>, allKeys: readonly string[]): string[] | undefined {
  const picked = allKeys.filter((k) => ticked.has(k));
  return picked.length === allKeys.length ? undefined : picked;
}

/** How many of the report's items a target reports. */
export function tickedCount(itemKeys: readonly string[] | null | undefined, allKeys: readonly string[]): number {
  return ticksFromTarget(itemKeys, allKeys).size;
}

// ── A report that already exists ─────────────────────────────────────────────

/** The fields of a saved version that say which criterion they stand for. */
export interface VersionCriterionField extends ItemSourceField {
  address: string;
  origin?: CriterionOrigin | null;
}

/**
 * What a saved criteria version says of its own cells, in the shape the wizard remembers a criteria report by: used
 * when the report's current file is taken again, so each cell keeps the criterion it stood for. Only the criteria
 * that have a cell are known here (a parent criterion has none: its figure is the sum of its children).
 */
export function criteriaMetaFromVersion(fields: readonly VersionCriterionField[]): CriteriaMeta {
  const refs: CriteriaFieldRef[] = [];
  const criteria: Criterion[] = [];
  for (const f of fields) {
    if (!f.itemKey) continue;
    const unit = f.unit ?? null;
    const parentItemKey = f.parentItemKey ?? null;
    const origin: CriterionOrigin = f.origin ?? 'FILE';
    refs.push({ address: f.address, fieldKey: f.fieldKey, itemKey: f.itemKey, unit, parentItemKey, origin });
    criteria.push({ itemKey: f.itemKey, code: null, name: f.label, unit, parentItemKey, origin, sourceRow: null });
  }
  return { criteria, fields: refs };
}

/**
 * "Sửa cấu hình": the teams as the config PATCH carries them. A team's `itemKeys` is sent only when its ticks are
 * not what the report has now, or the team is new; everything ticked is sent as null ("every criterion"). A team
 * left as it was sends none, so the server leaves its criteria alone.
 *
 * `next` is what the teams step hands over (`itemKeys` absent = everything ticked); `previous` is the report as loaded.
 */
export function targetsForConfigPatch(
  next: readonly ReportTargetConfig[],
  previous: ReadonlyArray<Pick<ReportTargetConfig, 'teamId' | 'itemKeys'>>,
  allKeys: readonly string[],
): ReportTargetConfig[] {
  // A report with no cells to pick from has no checklist: nothing about criteria is said at all.
  if (allKeys.length === 0) {
    return next.map((t) => ({ teamId: t.teamId, editorUserIds: t.editorUserIds }));
  }
  const before = new Map(previous.map((t) => [t.teamId, t]));
  return next.map((t) => {
    const base = { teamId: t.teamId, editorUserIds: t.editorUserIds };
    const now = t.itemKeys ?? null;
    const old = before.get(t.teamId);
    if (!old) return { ...base, itemKeys: now };
    // The ticks the screen opened with: the stored subset minus keys the report no longer has, "all" as null.
    const opened = itemKeysForPayload(ticksFromTarget(old.itemKeys, allKeys), allKeys) ?? null;
    return sameKeys(opened, now) ? base : { ...base, itemKeys: now };
  });
}

function sameKeys(a: readonly string[] | null, b: readonly string[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((k, i) => k === b[i]);
}
