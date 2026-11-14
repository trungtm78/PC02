import { ownedComments, ownedValues, ownedView } from './owned-view';

const fields = [
  { fieldKey: 'S!C2' },
  { fieldKey: 'S!C3' },
  { fieldKey: 'S!C4' },
];
const rule = (id: string, leftExpr: string, rightExpr: string) => ({ id, leftExpr, rightExpr });
const rules = [
  rule('own-both', 'C2', 'C3'),
  rule('other-team', 'C2', 'C4'),
  rule('constant', 'C3', '100'),
  rule('with-sheet', "'S'!C2 + S!C3", '0'),
  rule('range', 'SUM(C2:C4)', '10'),
  rule('unreadable', 'C2 +', '1'),
];

describe('ownedView: what an editor of this team works with', () => {
  it('a team with no subset gets the very same lists back (no copy, no filtering)', () => {
    const out = ownedView({ ownedFieldKeys: null }, fields, rules, 'S');
    expect(out.fields).toBe(fields);
    expect(out.rules).toBe(rules);
  });

  it('a team with a subset gets only its fields, in the version order', () => {
    const out = ownedView({ ownedFieldKeys: ['S!C3', 'S!C2'] }, fields, rules, 'S');
    expect(out.fields).toEqual([{ fieldKey: 'S!C2' }, { fieldKey: 'S!C3' }]);
  });

  it('keeps a rule only when every cell it reads is a field of this team', () => {
    const out = ownedView({ ownedFieldKeys: ['S!C2', 'S!C3'] }, fields, rules, 'S');
    // "other-team" reads C4, which this team does not report: it could never satisfy it.
    expect(out.rules.map((r) => r.id)).toEqual(['own-both', 'constant', 'with-sheet']);
  });

  it('a rule over a range, or one that cannot be read, is not applied to a team with a subset', () => {
    const out = ownedView({ ownedFieldKeys: ['S!C2', 'S!C3', 'S!C4'].slice(0, 2) }, fields, rules, 'S');
    expect(out.rules.map((r) => r.id)).not.toContain('range');
    expect(out.rules.map((r) => r.id)).not.toContain('unreadable');
  });

  it('a rule that names no sheet uses the default sheet; with none it cannot be placed and is dropped', () => {
    const out = ownedView({ ownedFieldKeys: ['S!C2', 'S!C3'] }, fields, [rule('bare', 'C2', 'C3')], null);
    expect(out.rules).toEqual([]);
  });

  it('a cell that is not an input of the version at all (a constant on the sheet) does not make a rule foreign', () => {
    const out = ownedView({ ownedFieldKeys: ['S!C2'] }, fields, [rule('vs-static', 'C2', 'Z99')], 'S');
    expect(out.rules.map((r) => r.id)).toEqual(['vs-static']);
  });
});

describe('ownedValues: the stored values an editor of this team is sent', () => {
  const stored = { 'S!C2': { t: 'NUM', v: '5' }, 'S!C4': { t: 'NUM', v: '999' } };

  it('a team with no subset gets the very same object back (a legacy report is read exactly as before)', () => {
    expect(ownedValues({ ownedFieldKeys: null }, stored)).toBe(stored);
    expect(ownedValues({}, stored)).toBe(stored);
  });

  it('a team with a subset gets only the values of its own fields: one saved before a criterion was taken away is left out', () => {
    expect(ownedValues({ ownedFieldKeys: ['S!C2', 'S!C3'] }, stored)).toEqual({ 'S!C2': { t: 'NUM', v: '5' } });
  });

  describe('ownedComments: the comments an editor of this team is sent', () => {
    const comments = [
      { id: 'own', fieldKey: 'S!C2' },
      { id: 'taken-away', fieldKey: 'S!C4' },
      { id: 'whole-submission', fieldKey: null },
    ];

    it('a team with no subset gets the very same list back', () => {
      expect(ownedComments({ ownedFieldKeys: null }, comments)).toBe(comments);
    });

    it('a comment on a field the team does not report is left out; one on its own field, or on the whole submission, stays', () => {
      expect(ownedComments({ ownedFieldKeys: ['S!C2'] }, comments).map((c) => c.id)).toEqual(['own', 'whole-submission']);
    });
  });

  it('never changes what is stored', () => {
    ownedValues({ ownedFieldKeys: ['S!C2'] }, stored);
    expect(Object.keys(stored)).toEqual(['S!C2', 'S!C4']);
  });
});
