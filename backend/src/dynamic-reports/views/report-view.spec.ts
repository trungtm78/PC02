import {
  looseDefinition,
  normaliseDefinition,
  normaliseView,
  readStoredItemKeys,
  readStoredTeamIds,
  storedItemKeys,
  ViewError,
} from './report-view';

const KNOWN = ['k1', 'k2', 'k3'];

function codeOf(fn: () => unknown): { code: string; unknown: string[] } | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (err instanceof ViewError) return { code: err.code, unknown: err.unknown };
    throw err;
  }
}

describe('normaliseDefinition', () => {
  it('nothing said means everything: all criteria, all teams, the filter line and the team columns on, no title', () => {
    expect(normaliseDefinition({}, KNOWN)).toEqual({
      title: null,
      showFilterLine: true,
      itemKeys: null,
      teamIds: null,
      teamColumns: true,
    });
  });

  it('keeps a concrete selection de-duplicated and in the order of the report, not the order it was ticked in', () => {
    expect(normaliseDefinition({ itemKeys: ['k3', 'k1', 'k3'] }, KNOWN).itemKeys).toEqual(['k1', 'k3']);
  });

  it('every criterion ticked is stored as "all", so a criterion added later is in it too', () => {
    expect(normaliseDefinition({ itemKeys: ['k2', 'k3', 'k1'] }, KNOWN).itemKeys).toBeNull();
  });

  it('refuses an empty list of criteria', () => {
    expect(codeOf(() => normaliseDefinition({ itemKeys: [] }, KNOWN))).toEqual({ code: 'VIEW_SELECTION_EMPTY', unknown: [] });
  });

  it('refuses a criterion the report does not have, naming it', () => {
    expect(codeOf(() => normaliseDefinition({ itemKeys: ['k1', 'zz'] }, KNOWN))).toEqual({
      code: 'VIEW_ITEM_KEY_UNKNOWN',
      unknown: ['zz'],
    });
  });

  it('refuses an empty list of teams', () => {
    expect(codeOf(() => normaliseDefinition({ teamIds: [] }, KNOWN))).toEqual({ code: 'VIEW_TEAMS_EMPTY', unknown: [] });
  });

  it('keeps the teams de-duplicated in the order given; without a list of known teams any id is taken', () => {
    expect(normaliseDefinition({ teamIds: ['t2', 't1', 't2'] }, KNOWN).teamIds).toEqual(['t2', 't1']);
  });

  it('with the known teams given, refuses a team that does not exist and never collapses the list to "all"', () => {
    expect(codeOf(() => normaliseDefinition({ teamIds: ['t1', 'gone'] }, KNOWN, ['t1', 't2']))).toEqual({
      code: 'VIEW_TEAM_UNKNOWN',
      unknown: ['gone'],
    });
    // "Every team that exists" is not "every team of a period": the list stays a list.
    expect(normaliseDefinition({ teamIds: ['t2', 't1'] }, KNOWN, ['t1', 't2']).teamIds).toEqual(['t2', 't1']);
  });

  it('a blank title is no title; a title is trimmed; one over 300 characters is refused', () => {
    expect(normaliseDefinition({ title: '   ' }, KNOWN).title).toBeNull();
    expect(normaliseDefinition({ title: '  Báo cáo quý  ' }, KNOWN).title).toBe('Báo cáo quý');
    expect(normaliseDefinition({ title: 'a'.repeat(300) }, KNOWN).title).toHaveLength(300);
    expect(codeOf(() => normaliseDefinition({ title: 'a'.repeat(301) }, KNOWN))?.code).toBe('VIEW_TITLE_TOO_LONG');
  });

  it('the two switches are kept when they are turned off', () => {
    expect(normaliseDefinition({ showFilterLine: false, teamColumns: false }, KNOWN)).toMatchObject({
      showFilterLine: false,
      teamColumns: false,
    });
  });
});

describe('looseDefinition (used on one period without being saved)', () => {
  it('takes any key and any team as given, de-duplicated: the period decides what it has', () => {
    expect(looseDefinition({ itemKeys: ['zz', 'k1', 'zz'], teamIds: ['t9', 't9'], title: ' T ' })).toEqual({
      title: 'T',
      showFilterLine: true,
      itemKeys: ['zz', 'k1'],
      teamIds: ['t9'],
      teamColumns: true,
    });
    expect(looseDefinition({})).toMatchObject({ itemKeys: null, teamIds: null });
  });

  it('still refuses an empty list and a title too long', () => {
    expect(codeOf(() => looseDefinition({ itemKeys: [] }))?.code).toBe('VIEW_SELECTION_EMPTY');
    expect(codeOf(() => looseDefinition({ teamIds: [] }))?.code).toBe('VIEW_TEAMS_EMPTY');
    expect(codeOf(() => looseDefinition({ title: 'a'.repeat(301) }))?.code).toBe('VIEW_TITLE_TOO_LONG');
  });
});

describe('normaliseView', () => {
  it('needs a name: trimmed, inner whitespace collapsed', () => {
    expect(normaliseView({ name: '  Gửi   cấp trên ' }, KNOWN).name).toBe('Gửi cấp trên');
    expect(codeOf(() => normaliseView({ name: '   ' }, KNOWN))?.code).toBe('VIEW_NAME_REQUIRED');
    expect(codeOf(() => normaliseView({ name: undefined }, KNOWN))?.code).toBe('VIEW_NAME_REQUIRED');
  });

  it('a name of 120 characters is taken, 121 is refused', () => {
    expect(normaliseView({ name: 'n'.repeat(120) }, KNOWN).name).toHaveLength(120);
    expect(codeOf(() => normaliseView({ name: 'n'.repeat(121) }, KNOWN))?.code).toBe('VIEW_NAME_TOO_LONG');
  });

  it('carries the definition with it', () => {
    expect(normaliseView({ name: 'A', itemKeys: ['k2'], teamIds: ['t1'], title: 'T' }, KNOWN)).toEqual({
      name: 'A',
      title: 'T',
      showFilterLine: true,
      itemKeys: ['k2'],
      teamIds: ['t1'],
      teamColumns: true,
    });
  });
});

describe('how a selection is stored', () => {
  it('"all" is stored as nothing; a list is stored with the keys that existed when it was saved', () => {
    expect(storedItemKeys(null, KNOWN)).toBeNull();
    expect(storedItemKeys(['k1'], KNOWN)).toEqual({ selected: ['k1'], known: KNOWN });
  });

  it('reads back what it stored, and reads anything else as "all"', () => {
    expect(readStoredItemKeys({ selected: ['k1'], known: ['k1', 'k2'] })).toEqual({ selected: ['k1'], known: ['k1', 'k2'] });
    expect(readStoredItemKeys(null)).toEqual({ selected: null, known: null });
    expect(readStoredItemKeys('junk')).toEqual({ selected: null, known: null });
    // A bare list (no record of what existed) is still a selection.
    expect(readStoredItemKeys(['k2', 7])).toEqual({ selected: ['k2'], known: null });
  });

  it('reads a stored list of teams, and anything else as "all"', () => {
    expect(readStoredTeamIds(['t1', 't2'])).toEqual(['t1', 't2']);
    expect(readStoredTeamIds(null)).toBeNull();
    expect(readStoredTeamIds({})).toBeNull();
  });
});
