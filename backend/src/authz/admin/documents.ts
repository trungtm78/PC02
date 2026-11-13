import { createHash } from 'node:crypto';
import { allowedDepths, depthRank, isSensitivePermission, resourceOfPermission } from '../../../prisma/permission-resources';
import { compile, isRecordScoped, widestReach } from '../engine/compile';
import { operationOf, recordScope } from '../engine/scope';
import type { AuthzConfig, OrgSnapshot, OverrideInput, Reach, TeamConfigInput, TemplateInput, UserInput } from '../engine/types';
import { entryProblems, type EntryProblem } from '../engine/validate';

/**
 * The permission configuration as DOCUMENTS: the whole of a template, of a team's configuration, of a person's
 * overrides. Every change is "this document becomes that document"; the history keeps both, and undo writes the
 * earlier one back. No partial updates, so there is nothing to merge and nothing half-applied.
 */
export interface TemplateDoc {
  code: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  entries: Record<string, Reach>;
}

export interface OverrideDoc {
  permission: string;
  effect: 'GRANT' | 'MUTE';
  reach: Reach | null;
  reason: string;
  /** ISO date-time, or null for no end. */
  expiresAt: string | null;
}

export interface TeamDoc {
  mode: 'INHERIT' | 'EXPLICIT';
  memberTemplateId: string | null;
  leaderTemplateId: string | null;
  overrides: (OverrideDoc & { audience: 'ALL' | 'MEMBER' | 'LEADER' })[];
}

export type ChangeItem =
  | { type: 'template'; id: string; before: TemplateDoc | null; after: TemplateDoc | null }
  | { type: 'team'; id: string; before: TeamDoc | null; after: TeamDoc | null }
  | { type: 'user'; id: string; before: OverrideDoc[]; after: OverrideDoc[] };

/** A change as asked for: the document an object should become (null = it should not exist). */
export type WantedItem =
  | { type: 'template'; id: string; after: TemplateDoc | null }
  | { type: 'team'; id: string; after: TeamDoc | null }
  | { type: 'user'; id: string; after: OverrideDoc[] };

/** Documents are compared as values: key order and override order do not make a difference. */
export function canonical(value: unknown): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys).map((x) => JSON.stringify(x)).sort();
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sortKeys(x)]));
    }
    return v;
  };
  return JSON.stringify(sortKeys(value));
}
export const sameDoc = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);

/** A short fingerprint of a document: what an editor sends back to prove what they read is still what is there. */
export const tokenOf = (doc: unknown): string => createHash('sha256').update(canonical(doc)).digest('hex').slice(0, 24);

const normaliseOverride = <T extends OverrideDoc>(o: T): T => ({
  ...o,
  reach: o.effect === 'GRANT' ? (o.reach ?? null) : null,
  reason: o.reason.trim(),
  expiresAt: o.expiresAt ? new Date(o.expiresAt).toISOString() : null,
});

/**
 * The document exactly as it will be stored. Everything downstream (comparison, validation, writing, history) uses
 * this one form, so what the history says was saved is what a later undo finds in the database.
 */
export function normalise<T extends WantedItem>(item: T): T {
  if (item.type === 'template') {
    const doc = item.after;
    return { ...item, after: doc && { ...doc, code: doc.code.trim(), name: doc.name.trim(), description: doc.description?.trim() || null } };
  }
  if (item.type === 'team') {
    const doc = item.after;
    return {
      ...item,
      after: doc && {
        mode: doc.mode,
        memberTemplateId: doc.memberTemplateId || null,
        leaderTemplateId: doc.leaderTemplateId || null,
        overrides: doc.overrides.map(normaliseOverride),
      },
    };
  }
  return { ...item, after: item.after.map(normaliseOverride) };
}

export type DocProblem =
  | EntryProblem
  | { code: 'TEMPLATE_NAME_REQUIRED' }
  | { code: 'TEMPLATE_NOT_FOUND'; templateId: string }
  | { code: 'TEMPLATE_ARCHIVED'; templateId: string }
  /** A team with its own configuration and no template for its members would leave them with nothing, by accident. */
  | { code: 'MEMBER_TEMPLATE_REQUIRED' }
  | { code: 'OVERRIDE_REASON_REQUIRED'; permission: string }
  | { code: 'OVERRIDE_REACH_REQUIRED'; permission: string }
  | { code: 'OVERRIDE_EXPIRED'; permission: string }
  | { code: 'OVERRIDE_DUPLICATE'; permission: string }
  /** The person saving does not hold this permission themselves. */
  | { code: 'ABOVE_OWN'; permission: string }
  /** A grant that needs a reason (see the catalogue's `sensitive`) was added without one. */
  | { code: 'SENSITIVE_REASON_REQUIRED'; permission: string };

export interface ValidationContext {
  /** Templates as they will be once the change is applied (id -> doc); archived ones included. */
  templates: ReadonlyMap<string, TemplateDoc>;
  /** What the person saving holds: nobody hands out what they do not have. */
  actorKeys: ReadonlySet<string>;
  /** The reason given for the whole change, if any. */
  reason: string | null;
  now: Date;
}

const AUDIENCES = ['MEMBER', 'LEADER'] as const;
const forAudience = (doc: TeamDoc, audience: (typeof AUDIENCES)[number]) =>
  doc.overrides.filter((o) => o.audience === 'ALL' || o.audience === audience);

/** What a team's configuration ends up giving one audience: its template, plus grants, minus mutes. */
function resolvedFor(doc: TeamDoc, audience: (typeof AUDIENCES)[number], templates: ReadonlyMap<string, TemplateDoc>): Map<string, Reach> {
  const templateId = audience === 'LEADER' ? (doc.leaderTemplateId ?? doc.memberTemplateId) : doc.memberTemplateId;
  const entries = new Map<string, Reach>(doc.mode === 'EXPLICIT' ? Object.entries(templates.get(templateId ?? '')?.entries ?? {}) : []);
  if (doc.mode !== 'EXPLICIT') return entries;
  const mine = forAudience(doc, audience);
  for (const o of mine) if (o.effect === 'GRANT' && o.reach) entries.set(o.permission, o.reach);
  for (const o of mine) if (o.effect === 'MUTE') entries.delete(o.permission);
  return entries;
}

/** "No end" is later than any date. */
const endOf = (expiresAt: string | null): number => (expiresAt ? new Date(expiresAt).getTime() : Number.POSITIVE_INFINITY);

/**
 * Everything a document can give, as `slot -> how much`. A slot is a place a permission is given from: a template
 * entry, what one audience of a team ends up with, one grant override (with its end), one mute (with its end: a mute
 * that ends sooner gives the permission back sooner).
 */
function capacity(item: ChangeItem, doc: TemplateDoc | TeamDoc | OverrideDoc[] | null, templates: ReadonlyMap<string, TemplateDoc>) {
  const slots = new Map<string, { permission: string; rank: number; end: number; mute?: boolean }>();
  if (!doc) return slots;
  const grant = (slot: string, permission: string, reach: Reach, expiresAt: string | null = null) =>
    slots.set(slot, { permission, rank: depthRank(reach), end: endOf(expiresAt) });
  const mute = (slot: string, permission: string, expiresAt: string | null) =>
    slots.set(slot, { permission, rank: 0, end: endOf(expiresAt), mute: true });
  if (item.type === 'template') {
    for (const [permission, reach] of Object.entries((doc as TemplateDoc).entries)) grant(permission, permission, reach);
  } else if (item.type === 'team') {
    const team = doc as TeamDoc;
    for (const audience of AUDIENCES) {
      for (const [permission, reach] of resolvedFor(team, audience, templates)) grant(`${audience}|${permission}`, permission, reach);
      for (const o of forAudience(team, audience)) {
        if (o.effect === 'GRANT' && o.reach) grant(`grant|${audience}|${o.permission}`, o.permission, o.reach, o.expiresAt);
        else if (o.effect === 'MUTE') mute(`mute|${audience}|${o.permission}`, o.permission, o.expiresAt);
      }
    }
  } else {
    for (const o of doc as OverrideDoc[]) {
      if (o.effect === 'GRANT' && o.reach) grant(`grant|${o.permission}`, o.permission, o.reach, o.expiresAt);
      else if (o.effect === 'MUTE') mute(`mute|${o.permission}`, o.permission, o.expiresAt);
    }
  }
  return slots;
}

/**
 * The permissions a change gives to somebody who did not have them from this document before: a new entry or grant,
 * a wider reach, a later end, another audience, a template put on a team, a mute lifted or ending sooner. Narrowing
 * and taking away are never additions.
 */
export function additionsOf(item: ChangeItem, templates: ReadonlyMap<string, TemplateDoc>): string[] {
  const before = capacity(item, item.before, templates);
  const after = capacity(item, item.after, templates);
  const added = new Set<string>();
  for (const [slot, now] of after) {
    const was = before.get(slot);
    if (now.mute) {
      if (was && now.end < was.end) added.add(now.permission);
    } else if (!was || now.rank > was.rank || now.end > was.end) added.add(now.permission);
  }
  for (const [slot, was] of before) if (was.mute && !after.has(slot)) added.add(was.permission);
  return [...added];
}

function overrideProblems(
  overrides: readonly OverrideDoc[],
  before: readonly OverrideDoc[],
  keyOf: (o: OverrideDoc) => string,
  now: Date,
): DocProblem[] {
  const problems: DocProblem[] = [];
  const seen = new Set<string>();
  const kept = new Set(before.map((o) => canonical(o)));
  for (const o of overrides) {
    if (!resourceOfPermission(o.permission)) problems.push({ code: 'PERMISSION_UNKNOWN', permission: o.permission });
    if (seen.has(keyOf(o))) problems.push({ code: 'OVERRIDE_DUPLICATE', permission: o.permission });
    seen.add(keyOf(o));
    if (!o.reason.trim()) problems.push({ code: 'OVERRIDE_REASON_REQUIRED', permission: o.permission });
    if (o.effect === 'GRANT') {
      if (!o.reach) problems.push({ code: 'OVERRIDE_REACH_REQUIRED', permission: o.permission });
      else if (!allowedDepths(o.permission).includes(o.reach)) problems.push({ code: 'REACH_NOT_ALLOWED', permission: o.permission, reach: o.reach });
    }
    // An override that ended while it sat in the document is not a mistake of whoever saves the document next.
    if (o.expiresAt && new Date(o.expiresAt).getTime() <= now.getTime() && !kept.has(canonical(o))) {
      problems.push({ code: 'OVERRIDE_EXPIRED', permission: o.permission });
    }
  }
  return problems;
}

/** A team's configuration must let each audience see whatever it may change, with the templates as they will be. */
export function viewProblemsOfTeam(doc: TeamDoc, templates: ReadonlyMap<string, TemplateDoc>): DocProblem[] {
  const problems: DocProblem[] = [];
  for (const audience of AUDIENCES) {
    for (const p of entryProblems(resolvedFor(doc, audience, templates))) {
      if (p.code === 'WIDER_THAN_VIEW' && !problems.some((x) => canonical(x) === canonical(p))) problems.push(p);
    }
  }
  return problems;
}

/**
 * Everything wrong with one change, before anything is written. What the change ADDS (see `additionsOf`) must be
 * held by whoever saves it, and needs a reason when it is sensitive; a document saved again untouched is not
 * judged for what it already contained.
 */
export function problemsOf(item: ChangeItem, ctx: ValidationContext): DocProblem[] {
  const problems: DocProblem[] = [];
  if (item.type === 'template' && item.after) {
    if (!item.after.name.trim()) problems.push({ code: 'TEMPLATE_NAME_REQUIRED' });
    problems.push(...entryProblems(new Map(Object.entries(item.after.entries))));
  }
  if (item.type === 'team' && item.after) {
    const doc = item.after;
    // "Members get nothing" is said with an empty template, on purpose; never by leaving the choice blank.
    if (doc.mode === 'EXPLICIT' && !doc.memberTemplateId) problems.push({ code: 'MEMBER_TEMPLATE_REQUIRED' });
    for (const templateId of new Set([doc.memberTemplateId, doc.leaderTemplateId])) {
      if (!templateId) continue;
      const template = ctx.templates.get(templateId);
      if (!template) problems.push({ code: 'TEMPLATE_NOT_FOUND', templateId });
      // A template being put on a team now must be in use; one the team already had may have been archived since.
      else if (template.status === 'ARCHIVED' && templateId !== item.before?.memberTemplateId && templateId !== item.before?.leaderTemplateId) {
        problems.push({ code: 'TEMPLATE_ARCHIVED', templateId });
      }
    }
    problems.push(
      ...overrideProblems(doc.overrides, item.before?.overrides ?? [], (o) => `${o.permission}|${(o as TeamDoc['overrides'][number]).audience}`, ctx.now),
    );
    problems.push(...viewProblemsOfTeam(doc, ctx.templates));
  }
  if (item.type === 'user') problems.push(...overrideProblems(item.after, item.before, (o) => o.permission, ctx.now));

  for (const permission of additionsOf(item, ctx.templates)) {
    if (!ctx.actorKeys.has(permission)) problems.push({ code: 'ABOVE_OWN', permission });
    if (isSensitivePermission(permission) && !ctx.reason?.trim()) problems.push({ code: 'SENSITIVE_REASON_REQUIRED', permission });
  }
  return problems;
}

// ── Preview: what a change would do to people ────────────────────────────────────────────────────────────────────

export interface PermissionDelta {
  permission: string;
  before: Reach | null;
  after: Reach | null;
  /** Teams whose records the permission starts or stops reaching (also when the reach word stays the same). */
  teamsGained?: string[];
  teamsLost?: string[];
  /**
   * Kept, but reaching LESS somewhere / MORE somewhere (both can be true): a team, the records of a team's people
   * wherever they sit, unassigned records, the person's own records. A reach can narrow with the same teams listed
   * (the team as a whole -> exactly the team), so the lists above alone do not say it.
   */
  narrower?: boolean;
  wider?: boolean;
}
export interface PersonImpact {
  userId: string;
  gained: PermissionDelta[];
  lost: PermissionDelta[];
  /** Kept, at another reach. */
  changed: PermissionDelta[];
}

const toOverrideInput = (o: OverrideDoc): OverrideInput => ({
  permission: o.permission,
  effect: o.effect,
  reach: o.reach,
  expiresAt: o.expiresAt ? new Date(o.expiresAt) : null,
});
export const templateInput = (id: string, doc: TemplateDoc): TemplateInput => ({ id, name: doc.name, entries: new Map(Object.entries(doc.entries)) });
export const teamInput = (teamId: string, doc: TeamDoc): TeamConfigInput => ({
  teamId,
  mode: doc.mode,
  memberTemplateId: doc.memberTemplateId,
  leaderTemplateId: doc.leaderTemplateId,
  overrides: doc.overrides.map((o) => ({ ...toOverrideInput(o), audience: o.audience })),
});

/** The configuration and the people as they would be with the wanted documents in place. Nothing is written. */
export function withChanges(
  config: AuthzConfig,
  users: ReadonlyMap<string, UserInput>,
  wanted: readonly WantedItem[],
): { config: AuthzConfig; users: Map<string, UserInput> } {
  const templates = new Map(config.templates);
  const teamConfigs = new Map(config.teamConfigs);
  const people = new Map(users);
  for (const item of wanted) {
    if (item.type === 'template') {
      if (item.after) templates.set(item.id, templateInput(item.id, item.after));
      else templates.delete(item.id);
    } else if (item.type === 'team') {
      if (item.after) teamConfigs.set(item.id, teamInput(item.id, item.after));
      else teamConfigs.delete(item.id);
    } else {
      const person = people.get(item.id);
      if (person) people.set(item.id, { ...person, overrides: item.after.map(toOverrideInput) });
    }
  }
  return { config: { templates, teamConfigs }, users: people };
}

/**
 * Who would gain or lose what. Everybody is computed both ways with the same engine the system will enforce with,
 * so the preview cannot disagree with what happens after saving.
 */
export function impactOf(
  org: OrgSnapshot,
  config: AuthzConfig,
  users: ReadonlyMap<string, UserInput>,
  wanted: readonly WantedItem[],
  now: Date,
): PersonImpact[] {
  return impactBetween(org, { config, users }, withChanges(config, users, wanted), now);
}

/** What a record permission reaches, as facts that can be compared one by one. */
interface Reached {
  all: boolean;
  own: boolean;
  unassigned: boolean;
  /** Assigned to exactly these teams. */
  exact: string[];
  /** These teams as a whole, and the records of these people wherever they sit. */
  treeTeams: string[];
  treeUsers: string[];
}
const NOTHING: Reached = { all: false, own: false, unassigned: false, exact: [], treeTeams: [], treeUsers: [] };

function reachedBy(org: OrgSnapshot, effective: ReturnType<typeof compile>, permission: string): Reached {
  if (!isRecordScoped(permission) || !effective.grants.has(permission)) return NOTHING;
  const scope = recordScope(org, effective, permission, operationOf(permission));
  if (scope.all) return { ...NOTHING, all: true };
  return {
    all: false,
    own: scope.own,
    unassigned: scope.tree?.includeUnassigned ?? false,
    exact: [...scope.exactTeamIds].sort(),
    treeTeams: [...(scope.tree?.teamIds ?? [])].sort(),
    treeUsers: [...(scope.tree?.userIds ?? [])].sort(),
  };
}
const teamsOf = (r: Reached): string[] => [...new Set([...r.exact, ...r.treeTeams])].sort();
/** Whether `a` reaches something `b` does not, for the person `userId`. */
function reachesBeyond(a: Reached, b: Reached, userId: string): boolean {
  if (b.all) return false;
  if (a.all) return true;
  // One's own records are also reached through a team as a whole one belongs to (its people include oneself).
  const ownOf = (r: Reached): boolean => r.own || r.treeUsers.includes(userId);
  if (ownOf(a) && !ownOf(b)) return true;
  if (a.unassigned && !b.unassigned) return true;
  const bTeams = teamsOf(b);
  if (teamsOf(a).some((t) => !bTeams.includes(t))) return true;
  return a.treeUsers.some((u) => !b.treeUsers.includes(u));
}

/**
 * The same between any two states of the configuration and the people (today against enforced, for instance).
 * Each side may be judged on its own picture of the organisation (`org`): "today" counts memberships the engine
 * no longer counts.
 */
export function impactBetween(
  org: OrgSnapshot,
  was: { config: AuthzConfig; users: ReadonlyMap<string, UserInput>; org?: OrgSnapshot },
  next: { config: AuthzConfig; users: ReadonlyMap<string, UserInput> },
  now: Date,
): PersonImpact[] {
  const impacts: PersonImpact[] = [];
  const orgBefore = was.org ?? org;
  for (const [userId, person] of was.users) {
    const before = compile(orgBefore, was.config, person, now);
    const after = compile(org, next.config, next.users.get(userId) ?? person, now);
    const impact: PersonImpact = { userId, gained: [], lost: [], changed: [] };
    for (const permission of new Set([...before.keys, ...after.keys])) {
      const delta: PermissionDelta = { permission, before: widestReach(before, permission), after: widestReach(after, permission) };
      const had = reachedBy(orgBefore, before, permission);
      const has = reachedBy(org, after, permission);
      const narrower = reachesBeyond(had, has, userId);
      const wider = reachesBeyond(has, had, userId);
      if (delta.before === delta.after && !narrower && !wider) continue;
      if (delta.before && delta.after) {
        const teamsGained = teamsOf(has).filter((t) => !teamsOf(had).includes(t));
        const teamsLost = teamsOf(had).filter((t) => !teamsOf(has).includes(t));
        if (teamsGained.length) delta.teamsGained = teamsGained;
        if (teamsLost.length) delta.teamsLost = teamsLost;
        if (narrower) delta.narrower = true;
        if (wider) delta.wider = true;
      }
      if (!delta.before) impact.gained.push(delta);
      else if (!delta.after) impact.lost.push(delta);
      else impact.changed.push(delta);
    }
    if (impact.gained.length || impact.lost.length || impact.changed.length) impacts.push(impact);
  }
  return impacts;
}
