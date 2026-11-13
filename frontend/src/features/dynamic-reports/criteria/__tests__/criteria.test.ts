import { describe, expect, it } from 'vitest';
import {
  addManualCriterion,
  applyCellPick,
  candidateAddresses,
  chosenKeys,
  columnLetters,
  depthsOf,
  fileFromBase64,
  filterGroups,
  groupItems,
  groupState,
  invertTicks,
  itemKeysForPayload,
  normaliseColumn,
  parentKeysOf,
  removeCriterion,
  reportableItems,
  rowsFromRange,
  selectWholeColumn,
  sheetColumns,
  slugKey,
  splitAddress,
  splitWarnings,
  tickAll,
  tickedCount,
  ticksFromTarget,
  toDrafts,
  toggleTick,
  untickAll,
  updateCriterion,
  withCriteriaMeta,
} from '../criteria';
import type { ReportableItem } from '../criteria';
import type { Criterion, ParsedField } from '../../types';
import { makeSheet } from '../../grid/__tests__/fixtures';

function criterion(over: Partial<Criterion> & Pick<Criterion, 'itemKey' | 'name'>): Criterion {
  return { code: null, unit: null, parentItemKey: null, origin: 'FILE', sourceRow: null, ...over };
}

function field(over: Partial<ParsedField> & Pick<ParsedField, 'fieldKey'>): ParsedField {
  const [sheetKey, address] = over.fieldKey.split('!');
  return { sheetKey, address, label: '', type: 'NUM', format: '', aggregate: 'SUM', source: 'TOKEN', ...over };
}

describe('addresses', () => {
  it('turns a column index into Excel letters', () => {
    expect([0, 1, 25, 26, 27, 701, 702].map(columnLetters)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });

  it('splits an A1 address, and refuses what is not one', () => {
    expect(splitAddress('B12')).toEqual({ column: 'B', row: 12 });
    expect(splitAddress('AB3')).toEqual({ column: 'AB', row: 3 });
    expect(splitAddress('B0')).toBeNull();
    expect(splitAddress('12')).toBeNull();
    expect(splitAddress('b2')).toBeNull();
  });

  it('accepts a typed column in any case, and nothing but one to three letters', () => {
    expect(normaliseColumn(' b ')).toBe('B');
    expect(normaliseColumn('ab')).toBe('AB');
    expect(normaliseColumn('B2')).toBeNull();
    expect(normaliseColumn('')).toBeNull();
    expect(normaliseColumn('ABCD')).toBeNull();
  });

  it('lists the columns of a sheet', () => {
    expect(sheetColumns({ cols: 3 })).toEqual(['A', 'B', 'C']);
  });

  it('offers only cells with text or a number in them', () => {
    const got = candidateAddresses(makeSheet());
    expect(got).toContain('B3'); // text
    expect(got).toContain('C4'); // number
    expect(got).not.toContain('C3'); // empty
    expect(got).not.toContain('C5'); // formula
    expect(candidateAddresses({ cells: { A1: { k: 'text', v: '   ', s: 0 } } })).toEqual([]);
  });
});

describe('picking one column, or some cells of one column', () => {
  it('a click on a column letter picks the whole column', () => {
    expect(selectWholeColumn('B')).toEqual({ column: 'B', rows: null });
  });

  it('the first pick of cells sets the column and its rows, in order', () => {
    expect(applyCellPick(null, ['B5', 'B3'], false)).toEqual({ selection: { column: 'B', rows: [3, 5] }, switched: false });
  });

  it('a new pick in the same column replaces the rows; with Ctrl it adds to them', () => {
    const current = { column: 'B', rows: [3] };
    expect(applyCellPick(current, ['B5'], false).selection).toEqual({ column: 'B', rows: [5] });
    expect(applyCellPick(current, ['B5', 'B4'], true).selection).toEqual({ column: 'B', rows: [3, 4, 5] });
  });

  it('Ctrl on cells that are all picked already removes them', () => {
    expect(applyCellPick({ column: 'B', rows: [3, 4, 5] }, ['B4'], true).selection).toEqual({ column: 'B', rows: [3, 5] });
    expect(applyCellPick({ column: 'B', rows: [3] }, ['B3'], true).selection).toBeNull();
  });

  it('a pick in ANOTHER column switches to it and drops the earlier cells, with or without Ctrl', () => {
    const current = { column: 'B', rows: [3, 4] };
    expect(applyCellPick(current, ['C4'], false)).toEqual({ selection: { column: 'C', rows: [4] }, switched: true });
    expect(applyCellPick(current, ['C4'], true)).toEqual({ selection: { column: 'C', rows: [4] }, switched: true });
  });

  it('a drag over several columns keeps the column already chosen when it touches it', () => {
    expect(applyCellPick({ column: 'B', rows: [3] }, ['A4', 'B4', 'A5', 'B5'], false)).toEqual({
      selection: { column: 'B', rows: [4, 5] },
      switched: false,
    });
  });

  it('a drag over several columns with nothing chosen yet takes the column of its first cell', () => {
    expect(applyCellPick(null, ['A4', 'B4', 'A5'], false).selection).toEqual({ column: 'A', rows: [4, 5] });
  });

  it('a pick over nothing clears the choice, unless Ctrl is held', () => {
    const current = { column: 'B', rows: [3] };
    expect(applyCellPick(current, [], false).selection).toBeNull();
    expect(applyCellPick(current, [], true).selection).toEqual(current);
  });

  it('adding cells to a whole column changes nothing; a plain pick in it narrows it to those cells', () => {
    const whole = selectWholeColumn('B');
    expect(applyCellPick(whole, ['B3'], true).selection).toEqual(whole);
    expect(applyCellPick(whole, ['B3'], false).selection).toEqual({ column: 'B', rows: [3] });
  });

  it('shades the picked cells among the candidates: all of a whole column, or just the picked rows', () => {
    const candidates = ['A3', 'B2', 'B3', 'B4'];
    expect([...chosenKeys('S', selectWholeColumn('B'), candidates)]).toEqual(['S!B2', 'S!B3', 'S!B4']);
    expect([...chosenKeys('S', { column: 'B', rows: [3, 9] }, candidates)]).toEqual(['S!B3']);
    expect(chosenKeys('S', null, candidates).size).toBe(0);
  });

  it('reads a typed row range; both blank is the whole column; nonsense is refused', () => {
    expect(rowsFromRange('', '')).toEqual({ rows: null });
    expect(rowsFromRange('3', '5')).toEqual({ rows: [3, 4, 5] });
    expect(rowsFromRange('5', '3')).toBeNull();
    expect(rowsFromRange('3', '')).toBeNull();
    expect(rowsFromRange('0', '2')).toBeNull();
    expect(rowsFromRange('a', '2')).toBeNull();
    expect(rowsFromRange('1', '999999')).toBeNull();
  });
});

describe('the reviewed list', () => {
  const LIST: Criterion[] = [
    criterion({ itemKey: 'toi-pham', name: 'I. Tội phạm', sourceRow: 2 }),
    criterion({ itemKey: 'trom-cap', name: 'Trộm cắp', parentItemKey: 'toi-pham', sourceRow: 3 }),
    criterion({ itemKey: 'trom-xe', name: 'Trộm xe', parentItemKey: 'trom-cap', sourceRow: 4 }),
    criterion({ itemKey: 'khac', name: 'Khác', sourceRow: 5 }),
  ];

  it('makes the same key the server would make of a Vietnamese name', () => {
    expect(slugKey('Số tin báo mới')).toBe('so-tin-bao-moi');
    expect(slugKey('Đơn  thư (đã xử lý)')).toBe('don-thu-da-xu-ly');
    expect(slugKey('***')).toBe('chi-tieu');
  });

  it('knows how deep each criterion sits and which ones are parents', () => {
    expect(Object.fromEntries(depthsOf(LIST))).toEqual({ 'toi-pham': 0, 'trom-cap': 1, 'trom-xe': 2, khac: 0 });
    expect([...parentKeysOf(LIST)].sort()).toEqual(['toi-pham', 'trom-cap']);
  });

  it('a parent that loops or is missing does not hang and counts as none', () => {
    const loop = [
      criterion({ itemKey: 'a', name: 'A', parentItemKey: 'b' }),
      criterion({ itemKey: 'b', name: 'B', parentItemKey: 'a' }),
      criterion({ itemKey: 'c', name: 'C', parentItemKey: 'gone' }),
    ];
    expect(depthsOf(loop).get('c')).toBe(0);
    expect(depthsOf(loop).get('a')).toBe(1);
  });

  it('renames one criterion and leaves the others alone', () => {
    const next = updateCriterion(LIST, 'khac', { name: 'Vụ khác', unit: 'vụ' });
    expect(next[3]).toMatchObject({ itemKey: 'khac', name: 'Vụ khác', unit: 'vụ' });
    expect(next[0]).toBe(LIST[0]);
  });

  it('removing a criterion moves its children up to its own parent', () => {
    const next = removeCriterion(LIST, 'trom-cap');
    expect(next.map((c) => c.itemKey)).toEqual(['toi-pham', 'trom-xe', 'khac']);
    expect(next[1].parentItemKey).toBe('toi-pham');
    expect(removeCriterion(LIST, 'toi-pham')[0]).toMatchObject({ itemKey: 'trom-cap', parentItemKey: null });
  });

  it('a hand-typed criterion is tagged MANUAL, gets a key of its own and goes to the end', () => {
    const next = addManualCriterion(LIST, { name: '  Ma  tuý ', unit: ' vụ ' });
    expect(next).toHaveLength(5);
    expect(next[4]).toEqual({
      itemKey: 'ma-tuy',
      code: null,
      name: 'Ma tuý',
      unit: 'vụ',
      parentItemKey: null,
      origin: 'MANUAL',
      sourceRow: null,
    });
  });

  it('a hand-typed criterion never takes a key that is in use', () => {
    const next = addManualCriterion(LIST, { name: 'Khác' });
    expect(next[4].itemKey).toBe('khac-2');
  });

  it('with a parent it is placed after that parent\'s last descendant', () => {
    const next = addManualCriterion(LIST, { name: 'Cướp', parentItemKey: 'toi-pham' });
    expect(next.map((c) => c.itemKey)).toEqual(['toi-pham', 'trom-cap', 'trom-xe', 'cuop', 'khac']);
    expect(next[3].parentItemKey).toBe('toi-pham');
  });

  it('a blank name adds nothing; an unknown parent is ignored', () => {
    expect(addManualCriterion(LIST, { name: '   ' })).toEqual(LIST);
    expect(addManualCriterion(LIST, { name: 'X', parentItemKey: 'gone' })[4].parentItemKey).toBeNull();
  });

  it('sends the list without nulls and without blank units', () => {
    const drafts = toDrafts([
      criterion({ itemKey: 'a', name: ' A ', unit: ' ', sourceRow: 2 }),
      criterion({ itemKey: 'b', name: 'B', unit: 'vụ', code: '1.1', parentItemKey: 'a', origin: 'MANUAL' }),
    ]);
    expect(drafts).toEqual([
      { itemKey: 'a', name: 'A', origin: 'FILE', sourceRow: 2 },
      { itemKey: 'b', code: '1.1', name: 'B', unit: 'vụ', parentItemKey: 'a', origin: 'MANUAL' },
    ]);
  });

  it('sorts warnings onto their rows and keeps the skipped blanks apart', () => {
    const got = splitWarnings([
      { code: 'BLANK_SKIPPED', row: 4 },
      { code: 'DUPLICATE_NAME', row: 6 },
      { code: 'NAME_TRUNCATED', row: 6 },
      { code: 'BLANK_SKIPPED', row: 9 },
    ]);
    expect(got.blankRows).toEqual([4, 9]);
    expect(got.byRow.get(6)).toEqual(['DUPLICATE_NAME', 'NAME_TRUNCATED']);
    expect(got.byRow.has(4)).toBe(false);
  });
});

describe('from the generated workbook to the wizard', () => {
  it('turns the base64 the server sent into an xlsx File with the same bytes', async () => {
    const file = fileFromBase64(btoa('PK\u0003\u0004abc'), 'tieu-chi.xlsx');
    expect(file.name).toBe('tieu-chi.xlsx');
    expect(file.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(file.size).toBe(7);
  });

  it('gives each field the criterion it stands for, matched by field key, and leaves the others alone', () => {
    const fields = [field({ fieldKey: 'Chỉ tiêu!C3', label: 'Trộm cắp' }), field({ fieldKey: 'Chỉ tiêu!C9', label: 'Lạ' })];
    const got = withCriteriaMeta(fields, {
      criteria: [],
      fields: [
        { address: 'C3', fieldKey: 'Chỉ tiêu!C3', itemKey: 'trom-cap', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE' },
      ],
    });
    expect(got[0]).toEqual({ ...fields[0], itemKey: 'trom-cap', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE' });
    expect(got[1]).toBe(fields[1]);
  });

  it('leaves null unit and parent out of the payload', () => {
    const got = withCriteriaMeta([field({ fieldKey: 'S!C2' })], {
      criteria: [],
      fields: [{ address: 'C2', fieldKey: 'S!C2', itemKey: 'x', unit: null, parentItemKey: null, origin: 'MANUAL' }],
    });
    expect(got[0]).not.toHaveProperty('unit');
    expect(got[0]).not.toHaveProperty('parentItemKey');
    expect(got[0]).toMatchObject({ itemKey: 'x', origin: 'MANUAL' });
  });

  it('an ordinary template (no criteria) is passed through untouched', () => {
    const fields = [field({ fieldKey: 'S!C2' })];
    expect(withCriteriaMeta(fields, null)).toEqual(fields);
  });
});

describe('what a team reports', () => {
  const CRITERIA: Criterion[] = [
    criterion({ itemKey: 'toi-pham', name: 'I. Tội phạm' }),
    criterion({ itemKey: 'trom-cap', name: 'Trộm cắp', parentItemKey: 'toi-pham', unit: 'vụ' }),
    criterion({ itemKey: 'cuop', name: 'Cướp', parentItemKey: 'toi-pham', unit: 'vụ' }),
    criterion({ itemKey: 'khac', name: 'Khác' }),
  ];
  const FIELDS: ParsedField[] = [
    field({ fieldKey: 'S!C3', label: 'Trộm cắp', itemKey: 'trom-cap', unit: 'vụ', parentItemKey: 'toi-pham' }),
    field({ fieldKey: 'S!C4', label: 'Cướp', itemKey: 'cuop', unit: 'vụ', parentItemKey: 'toi-pham' }),
    field({ fieldKey: 'S!C5', label: 'Khác', itemKey: 'khac' }),
  ];
  const ITEMS = reportableItems(FIELDS, CRITERIA);
  const KEYS = ITEMS.map((i) => i.key);

  it('a criteria report lists its criteria by item key; a parent is not an item (nobody types it)', () => {
    expect(ITEMS).toEqual<ReportableItem[]>([
      { key: 'trom-cap', label: 'Trộm cắp', unit: 'vụ', parentKey: 'toi-pham' },
      { key: 'cuop', label: 'Cướp', unit: 'vụ', parentKey: 'toi-pham' },
      { key: 'khac', label: 'Khác', unit: null, parentKey: null },
    ]);
  });

  it('an ordinary template lists its fields by label, keyed by field key', () => {
    expect(reportableItems([field({ fieldKey: 'Đội 3!C6', label: 'Số vụ mới' }), field({ fieldKey: 'Đội 3!C7' })])).toEqual([
      { key: 'Đội 3!C6', label: 'Số vụ mới', unit: null, parentKey: null },
      { key: 'Đội 3!C7', label: 'Đội 3!C7', unit: null, parentKey: null },
    ]);
  });

  it('groups children under their parent, named by the whole path of parents', () => {
    const groups = groupItems(ITEMS, CRITERIA);
    expect(groups.map((g) => [g.key, g.label, g.items.map((i) => i.key)])).toEqual([
      ['toi-pham', 'I. Tội phạm', ['trom-cap', 'cuop']],
      [null, null, ['khac']],
    ]);
    const deep = groupItems(
      [{ key: 'x', label: 'X', unit: null, parentKey: 'b' }],
      [criterion({ itemKey: 'a', name: 'A' }), criterion({ itemKey: 'b', name: 'B', parentItemKey: 'a' })],
    );
    expect(deep[0].label).toBe('A › B');
  });

  it('a template report is one group with no parent', () => {
    const items = reportableItems([field({ fieldKey: 'S!A1', label: 'A' }), field({ fieldKey: 'S!A2', label: 'B' })]);
    expect(groupItems(items)).toEqual([{ key: null, label: null, items }]);
  });

  it('search ignores case and accents, looks at label, unit and group name, and drops empty groups', () => {
    const groups = groupItems(ITEMS, CRITERIA);
    expect(filterGroups(groups, 'CUOP').flatMap((g) => g.items.map((i) => i.key))).toEqual(['cuop']);
    expect(filterGroups(groups, 'toi pham').flatMap((g) => g.items.map((i) => i.key))).toEqual(['trom-cap', 'cuop']);
    expect(filterGroups(groups, 'vụ').flatMap((g) => g.items.map((i) => i.key))).toEqual(['trom-cap', 'cuop']);
    expect(filterGroups(groups, 'zzz')).toEqual([]);
    expect(filterGroups(groups, '  ')).toEqual(groups);
  });

  it('tick all, clear all and invert act on the given keys and keep the rest', () => {
    const ticked = new Set(['trom-cap', 'khac']);
    expect([...tickAll(ticked, ['cuop'])].sort()).toEqual(['cuop', 'khac', 'trom-cap']);
    expect([...untickAll(ticked, ['trom-cap', 'cuop'])]).toEqual(['khac']);
    expect([...invertTicks(ticked, ['trom-cap', 'cuop'])].sort()).toEqual(['cuop', 'khac']);
    expect([...toggleTick(ticked, 'khac')]).toEqual(['trom-cap']);
    expect(ticked.size).toBe(2); // never changed in place
  });

  it('a parent\'s box is all, some or none of its children', () => {
    const group = groupItems(ITEMS, CRITERIA)[0];
    expect(groupState(new Set(KEYS), group)).toBe('all');
    expect(groupState(new Set(['cuop']), group)).toBe('some');
    expect(groupState(new Set(['khac']), group)).toBe('none');
  });

  it('a team with no subset starts with everything ticked; a subset drops keys the report no longer has', () => {
    expect([...ticksFromTarget(undefined, KEYS)]).toEqual(KEYS);
    expect([...ticksFromTarget(null, KEYS)]).toEqual(KEYS);
    expect([...ticksFromTarget(['cuop', 'gone'], KEYS)]).toEqual(['cuop']);
    expect(ticksFromTarget(['gone'], KEYS).size).toBe(0);
  });

  it('the payload leaves itemKeys out when everything is ticked, else lists the ticked keys in field order', () => {
    expect(itemKeysForPayload(new Set(KEYS), KEYS)).toBeUndefined();
    expect(itemKeysForPayload(new Set(['khac', 'trom-cap']), KEYS)).toEqual(['trom-cap', 'khac']);
    expect(itemKeysForPayload(new Set(), KEYS)).toEqual([]);
  });

  it('counts how many of the report\'s items a target reports', () => {
    expect(tickedCount(undefined, KEYS)).toBe(3);
    expect(tickedCount(['cuop'], KEYS)).toBe(1);
  });
});
