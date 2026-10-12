import { allocateSheetNames } from './sheet-names';

/**
 * A manager's file holds one copy of the template's sheets per scope (the
 * totals and every team). Excel allows a sheet name only 31 characters, no
 * `* ? : \ / [ ]`, and treats names case-insensitively — so the names are
 * allocated from one table, deterministically, and never collide.
 */

const SCOPES = [
  { scope: 'TOTAL', label: 'TỔNG' },
  { scope: 't1', label: 'Đội 3' },
  { scope: 't2', label: 'Cơ sở 2' },
];

function names(map: ReadonlyMap<string, string>): string[] {
  return [...map.values()];
}

describe('allocateSheetNames', () => {
  it('a single-sheet report names each copy after its scope, as the exports always did', () => {
    const map = allocateSheetNames(SCOPES, ['Thống kê']);
    expect(map.get('TOTAL\u0000Thống kê')).toBe('TỔNG');
    expect(map.get('t1\u0000Thống kê')).toBe('Đội 3');
    expect(map.get('t2\u0000Thống kê')).toBe('Cơ sở 2');
  });

  it('a multi-sheet report names each copy "<scope> - <sheet>"', () => {
    const map = allocateSheetNames(SCOPES, ['Vụ việc', 'Vụ án']);
    expect(map.get('t1\u0000Vụ việc')).toBe('Đội 3 - Vụ việc');
    expect(map.get('t1\u0000Vụ án')).toBe('Đội 3 - Vụ án');
    expect(map.get('TOTAL\u0000Vụ án')).toBe('TỔNG - Vụ án');
  });

  it('never exceeds 31 characters, whatever the names', () => {
    const map = allocateSheetNames(
      [
        { scope: 'a', label: 'Tổ công tác số 2 thuộc Phòng Cảnh sát hình sự' },
        { scope: 'b', label: 'Đội 3' },
      ],
      ['Thống kê số liệu vụ việc tạm đình chỉ', 'Vụ án'],
    );
    for (const name of names(map)) expect(name.length).toBeLessThanOrEqual(31);
  });

  it('every name is distinct even when truncation would make two the same (Excel compares case-insensitively)', () => {
    const map = allocateSheetNames(
      [
        { scope: 'a', label: 'Tổ công tác số 2 thuộc Phòng Cảnh sát hình sự A' },
        { scope: 'b', label: 'Tổ công tác số 2 thuộc Phòng Cảnh sát hình sự B' },
        { scope: 'c', label: 'TỔ CÔNG TÁC SỐ 2 THUỘC PHÒNG CẢNH SÁT HÌNH SỰ B' },
      ],
      ['x'],
    );
    const lower = names(map).map((n) => n.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
    for (const name of names(map)) expect(name.length).toBeLessThanOrEqual(31);
  });

  it('two teams with the same name get told apart', () => {
    const map = allocateSheetNames(
      [
        { scope: 'a', label: 'Đội 3' },
        { scope: 'b', label: 'Đội 3' },
      ],
      ['x'],
    );
    expect(new Set(names(map)).size).toBe(2);
  });

  it('removes the characters Excel forbids and never produces an empty or apostrophe-edged name', () => {
    const map = allocateSheetNames(
      [
        { scope: 'a', label: 'Tổ [1]/2: A*B?' },
        { scope: 'b', label: '   ' },
        { scope: 'c', label: "'Đội'" },
      ],
      ['x'],
    );
    for (const name of names(map)) {
      expect(name).not.toMatch(/[*?:\\/[\]]/);
      expect(name.trim().length).toBeGreaterThan(0);
      expect(name.startsWith("'")).toBe(false);
      expect(name.endsWith("'")).toBe(false);
    }
  });

  it('never uses a name Excel reserves or the identity sheet', () => {
    const map = allocateSheetNames([{ scope: 'a', label: 'History' }, { scope: 'b', label: '__dr_meta' }], ['x']);
    for (const name of names(map)) {
      expect(name.toLowerCase()).not.toBe('history');
      expect(name.toLowerCase()).not.toBe('__dr_meta');
    }
  });

  it('is deterministic: the same input always gives the same table', () => {
    const a = allocateSheetNames(SCOPES, ['Vụ việc', 'Vụ án']);
    const b = allocateSheetNames(SCOPES, ['Vụ việc', 'Vụ án']);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it('keeps the order scope-major: totals first, then the teams in the order given', () => {
    const map = allocateSheetNames(SCOPES, ['Vụ việc', 'Vụ án']);
    expect(names(map)[0]).toBe('TỔNG - Vụ việc');
    expect(names(map)[1]).toBe('TỔNG - Vụ án');
    expect(names(map)[2]).toBe('Đội 3 - Vụ việc');
  });
});
