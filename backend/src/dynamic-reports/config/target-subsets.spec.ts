import { normaliseTargetSubset, TargetSubsetError } from './target-subsets';

const fields = [
  { fieldKey: 'S!C2', itemKey: 'tin-moi' },
  { fieldKey: 'S!C3', itemKey: 'tin-cu' },
  { fieldKey: 'S!C4', itemKey: null },
];

describe('normaliseTargetSubset', () => {
  it('no subset means every criterion, stored as null', () => {
    expect(normaliseTargetSubset('t1', undefined, fields)).toBeNull();
    expect(normaliseTargetSubset('t1', null, fields)).toBeNull();
  });

  it('keeps the picked keys, once each, in the order of the report', () => {
    expect(normaliseTargetSubset('t1', ['S!C4', 'tin-moi', 'S!C4'], fields)).toEqual(['tin-moi', 'S!C4']);
  });

  it('picking every criterion is stored as "all", so a criterion added later is the team\'s too', () => {
    expect(normaliseTargetSubset('t1', ['tin-cu', 'S!C4', 'tin-moi'], fields)).toBeNull();
  });

  it('refuses an empty subset: a team that must report cannot owe nothing', () => {
    expect(() => normaliseTargetSubset('t1', [], fields)).toThrow(TargetSubsetError);
    try {
      normaliseTargetSubset('t1', [], fields);
    } catch (err) {
      expect(err).toMatchObject({ code: 'TARGET_SUBSET_EMPTY', teamId: 't1' });
    }
  });

  it('refuses a key the report does not have, naming it', () => {
    try {
      normaliseTargetSubset('t9', ['tin-moi', 'khong-co'], fields);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toMatchObject({ code: 'TARGET_ITEM_KEY_UNKNOWN', teamId: 't9', unknown: ['khong-co'] });
    }
  });
});
