import type { AuthzConfig, OrgSnapshot, UserInput } from '../engine/types';
import { canonical, impactOf, problemsOf, sameDoc, withChanges, type ChangeItem, type OverrideDoc, type TeamDoc, type TemplateDoc, type ValidationContext } from './documents';

const NOW = new Date('2026-11-14T00:00:00Z');
const tpl = (over: Partial<TemplateDoc> = {}): TemplateDoc => ({ code: 'T', name: 'Mẫu', description: null, status: 'ACTIVE', entries: {}, ...over });
const team = (over: Partial<TeamDoc> = {}): TeamDoc => ({ mode: 'EXPLICIT', memberTemplateId: null, leaderTemplateId: null, overrides: [], ...over });
const override = (over: Partial<OverrideDoc> = {}): OverrideDoc => ({ permission: 'read:Case', effect: 'GRANT', reach: 'OWN', reason: 'vì việc', expiresAt: null, ...over });
const ALL_KEYS = new Set(['read:Case', 'edit:Case', 'delete:Case', 'read:Petition', 'export_full:Petition', 'read:User', 'write:User', 'read:Directory']);
const ctx = (over: Partial<ValidationContext> = {}): ValidationContext => ({ templates: new Map(), actorKeys: ALL_KEYS, reason: null, now: NOW, ...over });
const codes = (item: ChangeItem, c = ctx()) => problemsOf(item, c).map((p) => p.code);

describe('documents are compared as values', () => {
  it('key order and list order make no difference; a different value does', () => {
    expect(sameDoc({ a: 1, b: [{ x: 1 }, { x: 2 }] }, { b: [{ x: 2 }, { x: 1 }], a: 1 })).toBe(true);
    expect(sameDoc({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameDoc(null, [])).toBe(false);
    expect(canonical({ b: 1, a: null })).toBe('{"a":null,"b":1}');
  });
});

describe('problemsOf a template', () => {
  it('a sound template has none', () => {
    expect(codes({ type: 'template', id: 't', before: null, after: tpl({ entries: { 'read:Case': 'TEAM', 'edit:Case': 'OWN' } }) })).toEqual([]);
  });

  it('needs a name, known permissions, allowed reaches, and seeing before changing', () => {
    expect(codes({ type: 'template', id: 't', before: null, after: tpl({ name: '  ' }) })).toEqual(['TEMPLATE_NAME_REQUIRED']);
    expect(
      codes({ type: 'template', id: 't', before: null, after: tpl({ entries: { 'edit:Case': 'TEAM', 'read:User': 'OWN' } }) }).sort(),
    ).toEqual(['REACH_NOT_ALLOWED', 'WIDER_THAN_VIEW']);
  });

  it('nobody hands out what they do not hold; what was already there, untouched, is not held against them', () => {
    const before = tpl({ entries: { 'read:Incident': 'OWN' } });
    const added: ChangeItem = { type: 'template', id: 't', before, after: tpl({ entries: { 'read:Incident': 'OWN', 'read:Lawyer': 'OWN', 'read:Case': 'OWN' } }) };
    expect(problemsOf(added, ctx())).toEqual([{ code: 'ABOVE_OWN', permission: 'read:Lawyer' }]);
    // The same permission at a wider reach IS an addition.
    const widened: ChangeItem = { type: 'template', id: 't', before, after: tpl({ entries: { 'read:Incident': 'TEAM' } }) };
    expect(problemsOf(widened, ctx())).toEqual([{ code: 'ABOVE_OWN', permission: 'read:Incident' }]);
  });

  it('a sensitive grant needs a reason for the change', () => {
    const item: ChangeItem = { type: 'template', id: 't', before: null, after: tpl({ entries: { 'read:Petition': 'ALL', 'export_full:Petition': 'ALL' } }) };
    expect(problemsOf(item, ctx())).toEqual([{ code: 'SENSITIVE_REASON_REQUIRED', permission: 'export_full:Petition' }]);
    expect(problemsOf(item, ctx({ reason: 'Phòng cần xuất báo cáo' }))).toEqual([]);
  });

  it('deleting a template is not judged', () => {
    expect(codes({ type: 'template', id: 't', before: tpl(), after: null })).toEqual([]);
  });
});

describe('problemsOf a team configuration', () => {
  const templates = new Map([
    ['m', tpl({ entries: { 'read:Case': 'OWN' } })],
    ['old', tpl({ status: 'ARCHIVED', entries: { 'read:Case': 'OWN' } })],
  ]);

  it('the templates must exist; an archived one cannot be newly chosen but may stay where it was', () => {
    expect(problemsOf({ type: 'team', id: 'A', before: null, after: team({ memberTemplateId: 'nope' }) }, ctx({ templates }))).toEqual([
      { code: 'TEMPLATE_NOT_FOUND', templateId: 'nope' },
    ]);
    expect(codes({ type: 'team', id: 'A', before: null, after: team({ leaderTemplateId: 'old' }) }, ctx({ templates }))).toEqual(['TEMPLATE_ARCHIVED']);
    expect(codes({ type: 'team', id: 'A', before: team({ memberTemplateId: 'old' }), after: team({ memberTemplateId: 'old', leaderTemplateId: 'm' }) }, ctx({ templates }))).toEqual([]);
  });

  it('an override needs a reason, a reach when it grants, an end still ahead, and to be the only one for its audience', () => {
    const doc = team({
      memberTemplateId: 'm',
      overrides: [
        { ...override({ reason: ' ', permission: 'read:Petition' }), audience: 'ALL' },
        { ...override({ reach: null, permission: 'read:Directory' }), audience: 'ALL' },
        { ...override({ expiresAt: '2026-11-01T00:00:00.000Z', permission: 'read:Case' }), audience: 'MEMBER' },
        { ...override({ permission: 'read:Case' }), audience: 'MEMBER' },
        { ...override({ permission: 'made:Up' }), audience: 'ALL' },
        { ...override({ permission: 'read:User', reach: 'TEAM' }), audience: 'ALL' },
      ],
    });
    expect([...new Set(codes({ type: 'team', id: 'A', before: null, after: doc }, ctx({ templates })))].sort()).toEqual(
      ['ABOVE_OWN', 'OVERRIDE_DUPLICATE', 'OVERRIDE_EXPIRED', 'OVERRIDE_REACH_REQUIRED', 'OVERRIDE_REASON_REQUIRED', 'PERMISSION_UNKNOWN', 'REACH_NOT_ALLOWED'].sort(),
    );
  });

  it('what an audience ends up with must still let people see what they may change', () => {
    // The template lets members see their own cases; the override lets them edit the whole team's.
    const wider = team({ memberTemplateId: 'm', overrides: [{ ...override({ permission: 'edit:Case', reach: 'TEAM' }), audience: 'MEMBER' }] });
    expect(problemsOf({ type: 'team', id: 'A', before: null, after: wider }, ctx({ templates }))).toEqual([
      { code: 'WIDER_THAN_VIEW', permission: 'edit:Case', reach: 'TEAM', view: 'read:Case', viewReach: 'OWN' },
    ]);
    // Muting "view" while "edit" stays is the same mistake.
    const blind = team({
      memberTemplateId: 'm',
      overrides: [
        { ...override({ permission: 'edit:Case', reach: 'OWN' }), audience: 'ALL' },
        { ...override({ permission: 'read:Case', effect: 'MUTE', reach: null }), audience: 'ALL' },
      ],
    });
    expect(codes({ type: 'team', id: 'A', before: null, after: blind }, ctx({ templates }))).toEqual(['WIDER_THAN_VIEW']);
  });

  it('removing a configuration is not judged', () => {
    expect(codes({ type: 'team', id: 'A', before: team(), after: null })).toEqual([]);
  });
});

describe('problemsOf a person\'s overrides', () => {
  it('judges each override, and holds only the new ones to "what the saver holds"', () => {
    const kept = override({ permission: 'read:Lawyer' });
    const item: ChangeItem = { type: 'user', id: 'u', before: [kept], after: [kept, override({ permission: 'read:Subject' }), override({ permission: 'read:Case', effect: 'MUTE', reach: null })] };
    expect(problemsOf(item, ctx())).toEqual([{ code: 'ABOVE_OWN', permission: 'read:Subject' }]);
    expect(codes({ type: 'user', id: 'u', before: [], after: [override(), override()] })).toEqual(['OVERRIDE_DUPLICATE']);
  });
});

describe('impactOf: who would gain or lose what', () => {
  const org: OrgSnapshot = {
    teams: new Map([['A', { id: 'A', parentId: null, active: true, wardId: null }]]),
    children: new Map(),
    members: new Map([['A', ['u1', 'u2']]]),
  };
  const config: AuthzConfig = { teamConfigs: new Map(), templates: new Map() };
  const person = (id: string, teams: string[]): UserInput => ({
    id, roleName: 'OFFICER', rolePermissions: ['read:Case', 'edit:Case', 'delete:Case'], canDispatch: false,
    memberships: teams.map((teamId) => ({ teamId, isLeader: false })), overrides: [], dataGrants: [],
  });
  const users = new Map([['u1', person('u1', ['A'])], ['u2', person('u2', ['A'])], ['u3', person('u3', [])]]);

  it('a template put on a team changes exactly its members: what they lose, what narrows, what they gain', () => {
    const impacts = impactOf(
      org, config, users,
      [
        { type: 'template', id: 't', after: tpl({ entries: { 'read:Case': 'OWN', 'edit:Case': 'TEAM_TREE', 'read:Petition': 'OWN' } }) },
        { type: 'team', id: 'A', after: team({ memberTemplateId: 't' }) },
      ],
      NOW,
    );
    expect(impacts.map((i) => i.userId)).toEqual(['u1', 'u2']);
    expect(impacts[0]).toEqual({
      userId: 'u1',
      gained: [{ permission: 'read:Petition', before: null, after: 'OWN' }],
      lost: [{ permission: 'delete:Case', before: 'TEAM_TREE', after: null }],
      changed: [{ permission: 'read:Case', before: 'TEAM_TREE', after: 'OWN' }],
    });
  });

  it('an override for one person touches only that person; nothing wanted touches nobody', () => {
    const impacts = impactOf(org, config, users, [{ type: 'user', id: 'u3', after: [override({ permission: 'read:Petition', reach: 'ALL' })] }], NOW);
    expect(impacts).toEqual([{ userId: 'u3', gained: [{ permission: 'read:Petition', before: null, after: 'ALL' }], lost: [], changed: [] }]);
    expect(impactOf(org, config, users, [], NOW)).toEqual([]);
  });

  it('withChanges removes what is wanted gone and ignores an override for nobody known', () => {
    const base: AuthzConfig = {
      templates: new Map([['t', { id: 't', name: 't', entries: new Map() }]]),
      teamConfigs: new Map([['A', { teamId: 'A', mode: 'EXPLICIT', memberTemplateId: 't', leaderTemplateId: null, overrides: [] }]]),
    };
    const next = withChanges(base, users, [
      { type: 'template', id: 't', after: null },
      { type: 'team', id: 'A', after: null },
      { type: 'user', id: 'ghost', after: [override()] },
    ]);
    expect(next.config.templates.size).toBe(0);
    expect(next.config.teamConfigs.size).toBe(0);
    expect(next.users.has('ghost')).toBe(false);
    // The original is not touched.
    expect(base.templates.size).toBe(1);
  });
});
