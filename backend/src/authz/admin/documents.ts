import { allowedDepths, isSensitivePermission, resourceOfPermission } from '../../../prisma/permission-resources';
import { compile, widestReach } from '../engine/compile';
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

export type DocProblem =
  | EntryProblem
  | { code: 'TEMPLATE_NAME_REQUIRED' }
  | { code: 'TEMPLATE_NOT_FOUND'; templateId: string }
  | { code: 'TEMPLATE_ARCHIVED'; templateId: string }
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

const grantsOf = (item: ChangeItem): Map<string, Reach> => {
  const out = new Map<string, Reach>();
  if (item.type === 'template') for (const [p, r] of Object.entries(item.after?.entries ?? {})) out.set(p, r);
  else {
    const overrides = item.type === 'team' ? (item.after?.overrides ?? []) : item.after;
    for (const o of overrides) if (o.effect === 'GRANT' && o.reach) out.set(o.permission, o.reach);
  }
  return out;
};
const grantsBefore = (item: ChangeItem): Map<string, Reach> =>
  grantsOf({ ...item, after: item.before } as ChangeItem);

function overrideProblems(overrides: readonly OverrideDoc[], keyOf: (o: OverrideDoc) => string, now: Date): DocProblem[] {
  const problems: DocProblem[] = [];
  const seen = new Set<string>();
  for (const o of overrides) {
    if (!resourceOfPermission(o.permission)) problems.push({ code: 'PERMISSION_UNKNOWN', permission: o.permission });
    if (seen.has(keyOf(o))) problems.push({ code: 'OVERRIDE_DUPLICATE', permission: o.permission });
    seen.add(keyOf(o));
    if (!o.reason.trim()) problems.push({ code: 'OVERRIDE_REASON_REQUIRED', permission: o.permission });
    if (o.effect === 'GRANT') {
      if (!o.reach) problems.push({ code: 'OVERRIDE_REACH_REQUIRED', permission: o.permission });
      else if (!allowedDepths(o.permission).includes(o.reach)) problems.push({ code: 'REACH_NOT_ALLOWED', permission: o.permission, reach: o.reach });
    }
    if (o.expiresAt && new Date(o.expiresAt).getTime() <= now.getTime()) problems.push({ code: 'OVERRIDE_EXPIRED', permission: o.permission });
  }
  return problems;
}

/**
 * Everything wrong with one change, before anything is written. Only what the change ADDS is held to "you cannot hand
 * out what you do not hold" and to "a sensitive grant needs a reason": saving a document that already contained such
 * a grant, untouched, is not refused.
 */
export function problemsOf(item: ChangeItem, ctx: ValidationContext): DocProblem[] {
  const problems: DocProblem[] = [];
  if (item.type === 'template' && item.after) {
    if (!item.after.name.trim()) problems.push({ code: 'TEMPLATE_NAME_REQUIRED' });
    problems.push(...entryProblems(new Map(Object.entries(item.after.entries))));
  }
  if (item.type === 'team' && item.after) {
    const doc = item.after;
    for (const templateId of [doc.memberTemplateId, doc.leaderTemplateId]) {
      if (!templateId) continue;
      const template = ctx.templates.get(templateId);
      if (!template) problems.push({ code: 'TEMPLATE_NOT_FOUND', templateId });
      // A template being put on a team now must be in use; one the team already had may have been archived since.
      else if (template.status === 'ARCHIVED' && templateId !== item.before?.memberTemplateId && templateId !== item.before?.leaderTemplateId) {
        problems.push({ code: 'TEMPLATE_ARCHIVED', templateId });
      }
    }
    problems.push(...overrideProblems(doc.overrides, (o) => `${o.permission}|${(o as TeamDoc['overrides'][number]).audience}`, ctx.now));
    // What each audience ends up with must still let people see what they may change.
    for (const audience of ['MEMBER', 'LEADER'] as const) {
      const templateId = audience === 'LEADER' ? (doc.leaderTemplateId ?? doc.memberTemplateId) : doc.memberTemplateId;
      const entries = new Map<string, Reach>(Object.entries(ctx.templates.get(templateId ?? '')?.entries ?? {}));
      const mine = doc.overrides.filter((o) => o.audience === 'ALL' || o.audience === audience);
      for (const o of mine) if (o.effect === 'GRANT' && o.reach) entries.set(o.permission, o.reach);
      for (const o of mine) if (o.effect === 'MUTE') entries.delete(o.permission);
      for (const p of entryProblems(entries)) {
        if (p.code === 'WIDER_THAN_VIEW' && !problems.some((x) => canonical(x) === canonical(p))) problems.push(p);
      }
    }
  }
  if (item.type === 'user') problems.push(...overrideProblems(item.after, (o) => o.permission, ctx.now));

  const before = grantsBefore(item);
  for (const [permission, reach] of grantsOf(item)) {
    if (before.get(permission) === reach) continue;
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
  const next = withChanges(config, users, wanted);
  const impacts: PersonImpact[] = [];
  for (const [userId, person] of users) {
    const before = compile(org, config, person, now);
    const after = compile(org, next.config, next.users.get(userId) ?? person, now);
    const impact: PersonImpact = { userId, gained: [], lost: [], changed: [] };
    for (const permission of new Set([...before.keys, ...after.keys])) {
      const delta = { permission, before: widestReach(before, permission), after: widestReach(after, permission) };
      if (delta.before === delta.after) continue;
      if (!delta.before) impact.gained.push(delta);
      else if (!delta.after) impact.lost.push(delta);
      else impact.changed.push(delta);
    }
    if (impact.gained.length || impact.lost.length || impact.changed.length) impacts.push(impact);
  }
  return impacts;
}
