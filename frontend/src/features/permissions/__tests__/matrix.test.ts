import { describe, it, expect } from 'vitest';
import {
  allowedReaches,
  canTick,
  columnState,
  defaultReach,
  diffCount,
  diffEntries,
  groupState,
  newlySensitive,
  permissionKeysOf,
  reachRank,
  sameEntries,
  setPermission,
  setView,
  tickColumn,
  tickGroup,
  viewReachOf,
} from '../matrix';
import { CAPABILITY, REACH, RESOURCE_GROUP, type Entries } from '../types';
import { RESOURCES, byKey } from './fixtures';

const petitions = byKey('petitions');
const calendar = byKey('calendar');
const reports = byKey('statutoryReports');
const ocrImport = byKey('ocrImport');

/** The server's rule, restated: nothing of a resource reaches further than its "view". */
function widerThanView(entries: Entries): string[] {
  return RESOURCES.flatMap((r) => {
    const view = r.basic.view;
    if (!view) return [];
    const viewReach = entries[view];
    return permissionKeysOf(r).filter(
      (key) => key !== view && entries[key] && (!viewReach || reachRank(entries[key]) > reachRank(viewReach)),
    );
  });
}

describe('reaches of a resource', () => {
  it('a record-scoped resource allows all four, anything else only ALL', () => {
    expect(allowedReaches(petitions)).toEqual([REACH.OWN, REACH.TEAM, REACH.TEAM_TREE, REACH.ALL]);
    expect(allowedReaches(calendar)).toEqual([REACH.ALL]);
    expect(defaultReach(petitions)).toBe(REACH.TEAM_TREE);
    expect(defaultReach(calendar)).toBe(REACH.ALL);
  });

  it('lists each permission key once even when two capabilities share it', () => {
    expect(permissionKeysOf(reports)).toEqual(['read:Report', 'write:Report', 'approve:Report']);
  });
});

describe('setView', () => {
  it('sets the reach of "view"', () => {
    expect(setView(petitions, {}, REACH.OWN)).toEqual({ 'read:Petition': REACH.OWN });
  });

  it('lowering "view" lowers whatever reached further, and leaves narrower ones alone', () => {
    const before: Entries = { 'read:Petition': REACH.ALL, 'edit:Petition': REACH.ALL, 'delete:Petition': REACH.OWN };
    expect(setView(petitions, before, REACH.TEAM_TREE)).toEqual({
      'read:Petition': REACH.TEAM_TREE,
      'edit:Petition': REACH.TEAM_TREE,
      'delete:Petition': REACH.OWN,
    });
  });

  it('raising "view" does not raise the others', () => {
    const before: Entries = { 'read:Petition': REACH.OWN, 'edit:Petition': REACH.OWN };
    expect(setView(petitions, before, REACH.ALL)).toEqual({ 'read:Petition': REACH.ALL, 'edit:Petition': REACH.OWN });
  });

  it('removing "view" removes everything of the resource, extras included, and nothing of another resource', () => {
    const before: Entries = {
      'read:Petition': REACH.ALL,
      'edit:Petition': REACH.ALL,
      'restore:Petition': REACH.ALL,
      'read:Case': REACH.OWN,
    };
    expect(setView(petitions, before, null)).toEqual({ 'read:Case': REACH.OWN });
  });

  it('refuses a reach the resource does not allow, and does nothing for a resource without "view"', () => {
    expect(setView(calendar, {}, REACH.OWN)).toEqual({});
    expect(setView(ocrImport, {}, REACH.ALL)).toEqual({});
  });
});

describe('setPermission', () => {
  it('a tick takes the reach of "view"', () => {
    const before: Entries = { 'read:Petition': REACH.OWN };
    expect(setPermission(petitions, before, 'edit:Petition', true)).toEqual({ 'read:Petition': REACH.OWN, 'edit:Petition': REACH.OWN });
  });

  it('nothing can be ticked while the resource is not visible', () => {
    expect(canTick(petitions, {})).toBe(false);
    expect(setPermission(petitions, {}, 'edit:Petition', true)).toEqual({});
  });

  it('unticking removes only that permission', () => {
    const before: Entries = { 'read:Petition': REACH.ALL, 'edit:Petition': REACH.ALL };
    expect(setPermission(petitions, before, 'edit:Petition', false)).toEqual({ 'read:Petition': REACH.ALL });
  });

  it('ticking the "view" key gives the default reach; unticking it clears the resource', () => {
    expect(setPermission(calendar, {}, 'read:Calendar', true)).toEqual({ 'read:Calendar': REACH.ALL });
    expect(setPermission(calendar, { 'read:Calendar': REACH.ALL, 'edit:Calendar': REACH.ALL }, 'read:Calendar', false)).toEqual({});
  });

  it('a resource without "view" is ticked freely', () => {
    expect(canTick(ocrImport, {})).toBe(true);
    expect(setPermission(ocrImport, {}, 'use:OcrImport', true)).toEqual({ 'use:OcrImport': REACH.ALL });
  });

  it('ignores a key that is not of the resource', () => {
    expect(setPermission(petitions, { 'read:Petition': REACH.ALL }, 'edit:Case', true)).toEqual({ 'read:Petition': REACH.ALL });
  });
});

describe('group tick', () => {
  it('on: every resource of the group becomes visible, record-scoped ones at "the whole team"', () => {
    const next = tickGroup(RESOURCES, {}, RESOURCE_GROUP.BUSINESS, true);
    expect(next['read:Petition']).toBe(REACH.TEAM_TREE);
    expect(next['read:Calendar']).toBe(REACH.ALL);
    expect(next['read:CaseGovernance']).toBe(REACH.ALL);
    expect(next['read:Report']).toBeUndefined();
    expect(groupState(RESOURCES, next, RESOURCE_GROUP.BUSINESS)).toBe('all');
  });

  it('on: a resource already visible keeps its reach', () => {
    const next = tickGroup(RESOURCES, { 'read:Petition': REACH.OWN }, RESOURCE_GROUP.BUSINESS, true);
    expect(next['read:Petition']).toBe(REACH.OWN);
  });

  it('off: everything of the group goes, other groups stay', () => {
    const before: Entries = { 'read:Petition': REACH.ALL, 'edit:Petition': REACH.ALL, 'read:Report': REACH.ALL, 'use:OcrImport': REACH.ALL };
    expect(tickGroup(RESOURCES, before, RESOURCE_GROUP.BUSINESS, false)).toEqual({ 'read:Report': REACH.ALL, 'use:OcrImport': REACH.ALL });
    expect(tickGroup(RESOURCES, before, RESOURCE_GROUP.ADMIN, false)['use:OcrImport']).toBeUndefined();
  });

  it('says none / some / all', () => {
    expect(groupState(RESOURCES, {}, RESOURCE_GROUP.REPORTS)).toBe('none');
    expect(groupState(RESOURCES, { 'read:Report': REACH.ALL }, RESOURCE_GROUP.REPORTS)).toBe('some');
  });
});

describe('column tick', () => {
  const visible: Entries = { 'read:Petition': REACH.OWN, 'read:Calendar': REACH.ALL };

  it('on: only rows that are visible get the capability, each at its own "view" reach', () => {
    const next = tickColumn(RESOURCES, visible, CAPABILITY.EDIT, true);
    expect(next).toEqual({ ...visible, 'edit:Petition': REACH.OWN, 'edit:Calendar': REACH.ALL });
    expect(columnState(RESOURCES, next, CAPABILITY.EDIT)).toBe('all');
  });

  it('off: the column is cleared', () => {
    const ticked = tickColumn(RESOURCES, visible, CAPABILITY.DELETE, true);
    expect(tickColumn(RESOURCES, ticked, CAPABILITY.DELETE, false)).toEqual(visible);
  });

  it('says none / some, and none when no row is visible', () => {
    expect(columnState(RESOURCES, {}, CAPABILITY.EDIT)).toBe('none');
    expect(columnState(RESOURCES, { ...visible, 'edit:Petition': REACH.OWN }, CAPABILITY.EDIT)).toBe('some');
  });
});

describe('the rule "no wider than view" survives any sequence of clicks', () => {
  it('holds after group ticks, column ticks, single ticks and lowering views', () => {
    let entries: Entries = {};
    for (const group of [RESOURCE_GROUP.BUSINESS, RESOURCE_GROUP.REPORTS, RESOURCE_GROUP.CATALOGUE, RESOURCE_GROUP.ADMIN]) {
      entries = tickGroup(RESOURCES, entries, group, true);
    }
    for (const capability of [CAPABILITY.CREATE, CAPABILITY.EDIT, CAPABILITY.DELETE]) {
      entries = tickColumn(RESOURCES, entries, capability, true);
    }
    for (const r of RESOURCES) for (const key of Object.values(r.extras)) entries = setPermission(r, entries, key, true);
    expect(widerThanView(entries)).toEqual([]);

    entries = setView(petitions, entries, REACH.ALL);
    entries = setView(petitions, entries, REACH.OWN);
    entries = setView(byKey('cases'), entries, null);
    entries = setPermission(byKey('cases'), entries, 'edit:Case', true);
    expect(widerThanView(entries)).toEqual([]);
    expect(entries['edit:Petition']).toBe(REACH.OWN);
    expect(entries['edit:Case']).toBeUndefined();
  });

  it('the check itself can fail (a wider entry is caught)', () => {
    expect(widerThanView({ 'read:Petition': REACH.OWN, 'edit:Petition': REACH.ALL })).toEqual(['edit:Petition']);
    expect(widerThanView({ 'edit:Petition': REACH.OWN })).toEqual(['edit:Petition']);
  });
});

describe('diffEntries', () => {
  it('says what was added, removed and given another reach', () => {
    const before: Entries = { 'read:Case': REACH.ALL, 'edit:Case': REACH.ALL, 'read:Petition': REACH.OWN };
    const after: Entries = { 'read:Case': REACH.OWN, 'read:Petition': REACH.OWN, 'write:Case': REACH.OWN };
    const diff = diffEntries(before, after);
    expect(diff).toEqual({
      added: [{ permission: 'write:Case', reach: REACH.OWN }],
      removed: [{ permission: 'edit:Case', reach: REACH.ALL }],
      changed: [{ permission: 'read:Case', before: REACH.ALL, after: REACH.OWN }],
    });
    expect(diffCount(diff)).toBe(3);
  });

  it('key order does not make a difference', () => {
    expect(sameEntries({ a: REACH.ALL, b: REACH.OWN }, { b: REACH.OWN, a: REACH.ALL })).toBe(true);
    expect(sameEntries({ a: REACH.ALL }, {})).toBe(false);
  });
});

describe('newlySensitive', () => {
  it('names sensitive permissions that are added or given another reach, not those left untouched', () => {
    const before: Entries = { 'read:User': REACH.ALL, 'write:User': REACH.ALL, 'export_full:Petition': REACH.OWN };
    const after: Entries = { ...before, 'delete:User': REACH.ALL, 'export_full:Petition': REACH.ALL, 'edit:Petition': REACH.ALL };
    expect(newlySensitive(RESOURCES, before, after)).toEqual(['delete:User', 'export_full:Petition']);
    expect(newlySensitive(RESOURCES, before, before)).toEqual([]);
  });

  it('removing a sensitive permission needs no reason', () => {
    expect(newlySensitive(RESOURCES, { 'write:User': REACH.ALL }, {})).toEqual([]);
  });

  it('view reach of a resource without "view" is null', () => {
    expect(viewReachOf(ocrImport, { 'use:OcrImport': REACH.ALL })).toBeNull();
  });
});
