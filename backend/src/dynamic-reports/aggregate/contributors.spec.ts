import {
  CONTRIBUTING_STATES,
  contributing,
  contributionsFor,
  contributorsFor,
  obligated,
  ownedFieldsOf,
  owns,
  type ContributorRow,
} from './contributors';

const a = (over: Record<string, unknown> = {}): ContributorRow & { id: string; teamId: string } => ({
  id: 'a1',
  teamId: 't1',
  obligation: 'REQUIRED',
  submission: { state: 'APPROVED', values: { 'S!B1': { v: '5' }, 'S!B2': { v: null } } },
  ...over,
});

describe('contributors', () => {
  describe('owns', () => {
    it('a team with no subset owns every field (null and undefined are the same: every report made before subsets)', () => {
      expect(owns(a({ ownedFieldKeys: null }), 'S!B1')).toBe(true);
      expect(owns(a(), 'S!B1')).toBe(true);
    });

    it('a team with a subset owns only what is in it', () => {
      const team = a({ ownedFieldKeys: ['S!B1'] });
      expect(owns(team, 'S!B1')).toBe(true);
      expect(owns(team, 'S!B2')).toBe(false);
    });

    it('an empty subset owns nothing (it is not "no subset")', () => {
      expect(owns(a({ ownedFieldKeys: [] }), 'S!B1')).toBe(false);
    });

    it('a stored value that is not a list of keys is read as "no subset", never as "owns nothing"', () => {
      expect(owns(a({ ownedFieldKeys: 'garbage' }), 'S!B1')).toBe(true);
    });
  });

  describe('obligated: must this team report this field', () => {
    it('an exempt team is obliged for nothing', () => {
      expect(obligated(a({ obligation: 'EXEMPT' }), 'S!B1')).toBe(false);
    });

    it('a required team is obliged only for the fields it owns, whatever the state of its submission', () => {
      const team = a({ ownedFieldKeys: ['S!B1'], submission: null });
      expect(obligated(team, 'S!B1')).toBe(true);
      expect(obligated(team, 'S!B2')).toBe(false);
    });
  });

  describe('contributing: is this team\'s figure in the total of this field', () => {
    it.each([
      ['APPROVED', 'APPROVED', true],
      ['APPROVED', 'SUBMITTED', false],
      ['SUBMITTED', 'SUBMITTED', true],
      ['SUBMITTED', 'DRAFT', false],
      ['ALL_SAVED', 'DRAFT', true],
      ['ALL_SAVED', 'RETURNED', true],
    ] as const)('mode %s, submission %s -> %s', (mode, state, expected) => {
      expect(contributing(a({ submission: { state, values: {} } }), 'S!B1', mode)).toBe(expected);
    });

    it('a team that never started counts as NOT_STARTED: in ALL_SAVED only', () => {
      const team = a({ submission: null });
      expect(contributing(team, 'S!B1', 'ALL_SAVED')).toBe(true);
      expect(contributing(team, 'S!B1', 'SUBMITTED')).toBe(false);
    });

    it('a field the team does not own is never in its contribution, not even as a zero', () => {
      const team = a({ ownedFieldKeys: ['S!B1'] });
      expect(contributing(team, 'S!B2', 'ALL_SAVED')).toBe(false);
    });

    it('an exempt team contributes nothing in any mode', () => {
      expect(contributing(a({ obligation: 'EXEMPT' }), 'S!B1', 'ALL_SAVED')).toBe(false);
    });
  });

  describe('contributorsFor / contributionsFor', () => {
    const t1 = a({ id: 'a1' });
    const t2 = a({ id: 'a2', ownedFieldKeys: ['S!B2'], submission: { state: 'APPROVED', values: { 'S!B1': { v: '9' }, 'S!B2': { v: '7' } } } });
    const t3 = a({ id: 'a3', submission: { state: 'DRAFT', values: { 'S!B1': { v: '100' } } } });

    it('lists, per field, the assignments that count and the value each brings', () => {
      expect(contributorsFor([t1, t2, t3], 'S!B1', 'APPROVED')).toEqual([{ assignment: t1, value: '5' }]);
      expect(contributorsFor([t1, t2, t3], 'S!B2', 'APPROVED')).toEqual([
        { assignment: t1, value: null },
        { assignment: t2, value: '7' },
      ]);
    });

    it('a value saved for a field the team does not own is ignored (t2 has 9 in B1 but does not own B1)', () => {
      expect(contributionsFor([t2], 'S!B1', 'APPROVED')).toEqual([]);
    });

    it('gives the engine its contribution list, keyed by assignment id', () => {
      expect(contributionsFor([t1, t2], 'S!B2', 'APPROVED')).toEqual([
        { sourceId: 'a1', value: null },
        { sourceId: 'a2', value: '7' },
      ]);
    });

    it('rows without an id (the what-if preview) are keyed by position', () => {
      const anon = { obligation: 'REQUIRED', submission: { state: 'SUBMITTED', values: { 'S!B1': { v: '3' } } } };
      expect(contributionsFor([anon], 'S!B1', 'SUBMITTED')).toEqual([{ sourceId: '0', value: '3' }]);
    });
  });

  describe('ownedFieldsOf', () => {
    const fields = [{ fieldKey: 'S!B1' }, { fieldKey: 'S!B2' }];
    it('returns every field for a team with no subset, and only the owned ones otherwise, in the version order', () => {
      expect(ownedFieldsOf(a(), fields)).toEqual(fields);
      expect(ownedFieldsOf(a({ ownedFieldKeys: ['S!B2', 'S!GONE'] }), fields)).toEqual([{ fieldKey: 'S!B2' }]);
    });
  });

  it('keeps the one table of states the screen, the close and the export all read', () => {
    expect(CONTRIBUTING_STATES).toEqual({
      SUBMITTED: ['SUBMITTED', 'APPROVED'],
      APPROVED: ['APPROVED'],
      ALL_SAVED: ['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED'],
    });
  });
});
