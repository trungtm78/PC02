import { describe, it, expect } from 'vitest';
import {
  criteriaGroupsForPayload,
  criteriaMetaFromVersion,
  criterionLabel,
  periodChecklist,
} from '../criteria';
import type { Criterion } from '../../types';

const criterion = (over: Partial<Criterion> & Pick<Criterion, 'itemKey' | 'name'>): Criterion => ({
  code: null,
  unit: null,
  parentItemKey: null,
  origin: 'FILE',
  sourceRow: null,
  ...over,
});

describe('criterionLabel', () => {
  it('puts the code before the name', () => {
    expect(criterionLabel('1.1', 'Số tin báo mới')).toBe('1.1 Số tin báo mới');
  });

  it.each([null, undefined, '', '   '])('a criterion without a code (%j) is its name alone', (code) => {
    expect(criterionLabel(code, 'Số tin báo mới')).toBe('Số tin báo mới');
  });

  it.each(['1.1 Số tin báo mới', '1.1. Số tin báo mới', '1.1) Số tin báo mới', '1.1'])(
    'a name that already begins with the code is left as it is: %s',
    (name) => {
      expect(criterionLabel('1.1', name)).toBe(name);
    },
  );

  it('a name that only happens to start with the same characters still gets the code', () => {
    expect(criterionLabel('1', '10 vụ trở lên')).toBe('1 10 vụ trở lên');
  });
});

describe('criteriaGroupsForPayload', () => {
  it('carries only the criteria that have children, in list order, without blank codes or null parents', () => {
    const groups = criteriaGroupsForPayload([
      criterion({ itemKey: 'tin', name: ' Tin báo ', code: ' I ' }),
      criterion({ itemKey: 'tin-moi', name: 'Tin mới', code: '1', parentItemKey: 'tin' }),
      criterion({ itemKey: 'sub', name: 'Nhóm con', code: '  ', parentItemKey: 'tin' }),
      criterion({ itemKey: 'leaf', name: 'Lá', parentItemKey: 'sub' }),
      criterion({ itemKey: 'alone', name: 'Một mình' }),
    ]);
    expect(groups).toEqual([
      { itemKey: 'tin', code: 'I', name: 'Tin báo' },
      { itemKey: 'sub', name: 'Nhóm con', parentItemKey: 'tin' },
    ]);
  });

  it('a flat list has no headings', () => {
    expect(criteriaGroupsForPayload([criterion({ itemKey: 'a', name: 'A' })])).toEqual([]);
  });
});

describe('criteriaMetaFromVersion with the saved headings', () => {
  const fields = [
    { address: 'C2', fieldKey: 'S!C2', label: 'Tin mới', itemKey: 'tin-moi', unit: 'tin', parentItemKey: 'tin', origin: 'FILE' as const, criterionCode: ' 1.1 ' },
    { address: 'C3', fieldKey: 'S!C3', label: 'Tin cũ', itemKey: 'tin-cu', unit: null, parentItemKey: 'tin', origin: 'MANUAL' as const, criterionCode: null },
  ];
  const groups = [{ itemKey: 'tin', code: 'I', name: 'Tin báo', parentItemKey: null }];

  it('the headings come first with their names and codes, then the cells with theirs', () => {
    const meta = criteriaMetaFromVersion(fields, groups);
    expect(meta.criteria.map((c) => [c.itemKey, c.code, c.name, c.parentItemKey])).toEqual([
      ['tin', 'I', 'Tin báo', null],
      ['tin-moi', '1.1', 'Tin mới', 'tin'],
      ['tin-cu', null, 'Tin cũ', 'tin'],
    ]);
  });

  it('the round trip keeps the headings: what was saved is what is sent again', () => {
    const meta = criteriaMetaFromVersion(fields, groups);
    expect(criteriaGroupsForPayload(meta.criteria)).toEqual([{ itemKey: 'tin', code: 'I', name: 'Tin báo' }]);
  });

  it('a version saved before headings were kept (none given) still gives its cells', () => {
    expect(criteriaMetaFromVersion(fields).criteria.map((c) => c.itemKey)).toEqual(['tin-moi', 'tin-cu']);
    expect(criteriaMetaFromVersion(fields, null).criteria).toHaveLength(2);
  });
});

describe('periodChecklist', () => {
  const view = {
    criteria: [
      { itemKey: 'tin-moi', fieldKey: 'S!C2', code: '1.1', label: 'Tin mới', unit: 'tin', parentItemKey: 'tin' },
      { itemKey: 'tin-cu', fieldKey: 'S!C3', code: null, label: 'Tin cũ', unit: null, parentItemKey: 'tin' },
      { itemKey: 'vu', fieldKey: 'S!C5', code: '2', label: 'Vụ khởi tố', unit: 'vụ', parentItemKey: null },
    ],
    groups: [{ itemKey: 'tin', code: 'I', name: 'Tin báo', parentItemKey: null }],
    assignments: [
      { assignmentId: 'sub', ownedFieldKeys: ['S!C2', 'S!C5'] },
      { assignmentId: 'all', ownedFieldKeys: null },
    ],
  };

  it('ticks, as ITEM keys, the criteria whose FIELD keys the team owns', () => {
    const list = periodChecklist(view, 'sub');
    expect(list.allKeys).toEqual(['tin-moi', 'tin-cu', 'vu']);
    expect([...list.ticked].sort()).toEqual(['tin-moi', 'vu']);
    expect(list.items.map((i) => i.label)).toEqual(['1.1 Tin mới', 'Tin cũ', '2 Vụ khởi tố']);
  });

  it.each(['all', 'not-listed'])('a team with null, or with no entry (%s), reports everything', (id) => {
    expect([...periodChecklist(view, id).ticked]).toEqual(['tin-moi', 'tin-cu', 'vu']);
  });

  it('groups the criteria under the saved heading', () => {
    const texts = JSON.stringify(periodChecklist(view, 'sub').groups);
    expect(texts).toContain('Tin báo');
  });
});
