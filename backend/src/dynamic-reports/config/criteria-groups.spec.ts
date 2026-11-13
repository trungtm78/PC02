import { assertCriteriaGroups, criteriaGroupsColumn, criteriaGroupsOf } from './report-config.service';

const fields = [{ itemKey: 'tin-moi' }, { itemKey: 'tin-cu' }, { itemKey: null }, {}];

describe('group headings of a criteria report', () => {
  it('a tree of headings apart from the cells is kept as it is, and read back', () => {
    const column = criteriaGroupsColumn(
      [
        { itemKey: 'tin', code: 'I', name: 'Tin báo' },
        { itemKey: 'tin-con', name: 'Nhóm con', parentItemKey: 'tin' },
      ],
      fields,
    );
    expect(criteriaGroupsOf(column.sourceSelection)).toEqual([
      { itemKey: 'tin', code: 'I', name: 'Tin báo', parentItemKey: null },
      { itemKey: 'tin-con', code: null, name: 'Nhóm con', parentItemKey: 'tin' },
    ]);
  });

  it('no headings: nothing is written, and nothing is read back from an empty column', () => {
    expect(criteriaGroupsColumn(undefined, fields)).toEqual({});
    expect(criteriaGroupsColumn([], fields)).toEqual({});
    expect(criteriaGroupsOf(null)).toEqual([]);
    expect(criteriaGroupsOf({ groups: 'x' })).toEqual([]);
  });

  it.each([
    ['the same key twice', [{ itemKey: 'a' }, { itemKey: 'a' }]],
    ['a key that is also an input cell', [{ itemKey: 'tin-moi' }]],
    ['a parent that is not a heading', [{ itemKey: 'a', parentItemKey: 'tin-cu' }]],
    ['a parent that does not exist', [{ itemKey: 'a', parentItemKey: 'nowhere' }]],
    ['a heading that is its own parent', [{ itemKey: 'a', parentItemKey: 'a' }]],
    ['a cycle of headings', [{ itemKey: 'a', parentItemKey: 'b' }, { itemKey: 'b', parentItemKey: 'c' }, { itemKey: 'c', parentItemKey: 'a' }]],
  ])('refuses %s', (_name, groups) => {
    expect(() => assertCriteriaGroups(groups, fields)).toThrow(expect.objectContaining({ code: 'CRITERIA_GROUPS_INVALID' }));
    expect(() => criteriaGroupsColumn(groups.map((g) => ({ ...g, name: 'x' })), fields)).toThrow(
      expect.objectContaining({ code: 'CRITERIA_GROUPS_INVALID' }),
    );
  });

  it('a deep chain that ends is fine', () => {
    expect(() =>
      assertCriteriaGroups([{ itemKey: 'a' }, { itemKey: 'b', parentItemKey: 'a' }, { itemKey: 'c', parentItemKey: 'b' }], fields),
    ).not.toThrow();
  });
});
