import { allowedDepths, depthRank, resourceOfPermission, scopeSubjectOf } from '../../../prisma/permission-resources';
import type {
  AuthzConfig,
  EffectivePermissions,
  Grant,
  MuteSource,
  OrgSnapshot,
  OverrideInput,
  Reach,
  TeamConfigInput,
  UserInput,
} from './types';

export const ADMIN_ROLE = 'ADMIN';
/** A hierarchy deeper than this is a loop or a mistake; walking stops instead of hanging. */
const MAX_DEPTH = 50;

const live = (expiresAt: Date | null, now: Date): boolean => expiresAt === null || expiresAt.getTime() > now.getTime();

/** True when the permission can be limited by records (its resource, or its parent's, has a team and an owner). */
export function isRecordScoped(permission: string): boolean {
  const resource = resourceOfPermission(permission);
  return !!resource && scopeSubjectOf(resource) !== undefined;
}

/** What a ROLE holds has no reach of its own: as far as a team reaches today for records, simply held otherwise. */
const roleReach = (permission: string): Reach => (isRecordScoped(permission) ? 'TEAM_TREE' : 'ALL');

/**
 * The configuration that governs a team: its own if EXPLICIT, else its nearest ancestor's that is. Null = nobody up
 * the line has set anything, so the person keeps what their role holds (today's behaviour).
 */
export function governingConfig(org: OrgSnapshot, config: AuthzConfig, teamId: string): TeamConfigInput | null {
  const seen = new Set<string>();
  for (let id: string | null = teamId, depth = 0; id && !seen.has(id) && depth < MAX_DEPTH; depth += 1) {
    seen.add(id);
    const own = config.teamConfigs.get(id);
    if (own?.mode === 'EXPLICIT') return own;
    id = org.teams.get(id)?.parentId ?? null;
  }
  return null;
}

/**
 * What one person may do, from the organisation, the permission configuration and the moment. PURE: the same inputs
 * give the same answer, and `now` is an input, so an override that has expired is simply not there (the caller keeps
 * the answer no longer than `validUntil`).
 *
 * Grants ADD UP per membership: what team A gives reaches A's records, what team B gives reaches B's. A person is
 * never worse off for belonging to one more team. Only an override that MUTES takes something away: a team's mute
 * from what that team gives, a personal mute from everything.
 */
export function compile(org: OrgSnapshot, config: AuthzConfig, user: UserInput, now: Date): EffectivePermissions {
  const grants = new Map<string, Grant[]>();
  const muted = new Map<string, MuteSource[]>();
  const expiries: Date[] = [];
  const add = (permission: string, grant: Grant) => {
    // A configured reach the permission cannot have ("users: own records only") is a broken row, not a request for
    // everything: it grants NOTHING. The save path refuses such rows; this is for one that got in another way.
    if (!allowedDepths(permission).includes(grant.reach)) return;
    grants.set(permission, [...(grants.get(permission) ?? []), grant]);
  };
  const noteMute = (permission: string, source: MuteSource) => muted.set(permission, [...(muted.get(permission) ?? []), source]);
  const consider = (o: OverrideInput): boolean => {
    if (!live(o.expiresAt, now)) return false;
    if (o.expiresAt) expiries.push(o.expiresAt);
    return true;
  };

  const dataGrants = user.dataGrants.filter((g) => {
    if (!live(g.expiresAt, now) || !org.teams.get(g.teamId)?.active) return false;
    if (g.expiresAt) expiries.push(g.expiresAt);
    return true;
  });
  const validUntil = () => (expiries.length ? new Date(Math.min(...expiries.map((d) => d.getTime()))) : null);
  /** Held through nothing but a conditional grant of the role (a template or an override gives it outright). */
  const conditionalOnly = (): string[] => {
    const conditional = new Set(user.conditionalRolePermissions ?? []);
    return [...grants].filter(([key, list]) => conditional.has(key) && list.every((g) => g.source.kind === 'ROLE')).map(([key]) => key).sort();
  };

  if (user.roleName === ADMIN_ROLE) {
    for (const p of user.rolePermissions) add(p, { reach: 'ALL', teamId: null, source: { kind: 'ROLE', teamId: null } });
    return {
      userId: user.id,
      admin: true,
      keys: [...grants.keys()].sort(),
      conditional: conditionalOnly(),
      grants,
      muted,
      activeTeamIds: [],
      wardTeamId: null,
      canDispatch: user.canDispatch,
      dataGrants: [],
      validUntil: null,
    };
  }

  const memberships = user.memberships.filter((m) => org.teams.get(m.teamId)?.active);
  const fromRole = (teamId: string | null) => {
    for (const p of user.rolePermissions) add(p, { reach: roleReach(p), teamId, source: { kind: 'ROLE', teamId } });
  };

  // A person in no team that counts keeps what their role holds, over their own records (there is no team to reach).
  if (memberships.length === 0) fromRole(null);

  for (const m of memberships) {
    const governing = governingConfig(org, config, m.teamId);
    if (!governing) {
      fromRole(m.teamId);
      continue;
    }
    const leaderTemplate = m.isLeader ? governing.leaderTemplateId : null;
    const templateId = leaderTemplate ?? governing.memberTemplateId;
    const template = templateId ? config.templates.get(templateId) : undefined;
    const given = new Map<string, Grant>();
    for (const [permission, reach] of template?.entries ?? []) {
      given.set(permission, {
        reach,
        teamId: m.teamId,
        source: { kind: 'TEMPLATE', teamId: m.teamId, configTeamId: governing.teamId, templateId: template!.id, asLeader: !!leaderTemplate },
      });
    }
    const mine = governing.overrides.filter((o) => o.audience === 'ALL' || (o.audience === 'LEADER') === m.isLeader);
    const source = { kind: 'TEAM_OVERRIDE' as const, teamId: m.teamId, configTeamId: governing.teamId };
    // Grants first, mutes last: where both name a permission, taking away wins.
    for (const o of mine) if (o.effect === 'GRANT' && o.reach && consider(o)) given.set(o.permission, { reach: o.reach, teamId: m.teamId, source });
    for (const o of mine) {
      if (o.effect !== 'MUTE' || !consider(o)) continue;
      if (given.delete(o.permission)) noteMute(o.permission, source);
    }
    for (const [permission, grant] of given) add(permission, grant);
  }

  for (const o of user.overrides) {
    if (o.effect === 'GRANT' && o.reach && consider(o)) add(o.permission, { reach: o.reach, teamId: null, source: { kind: 'USER_OVERRIDE' } });
  }
  for (const o of user.overrides) {
    if (o.effect !== 'MUTE' || !consider(o)) continue;
    if (grants.delete(o.permission)) noteMute(o.permission, { kind: 'USER_OVERRIDE' });
  }

  const ward = memberships.find((m) => org.teams.get(m.teamId)?.wardId != null);
  return {
    userId: user.id,
    admin: false,
    keys: [...grants.keys()].sort(),
    conditional: conditionalOnly(),
    grants,
    muted,
    activeTeamIds: memberships.map((m) => m.teamId),
    wardTeamId: ward?.teamId ?? null,
    canDispatch: user.canDispatch,
    dataGrants: dataGrants.map((g) => ({ teamId: g.teamId, level: g.level })),
    validUntil: validUntil(),
  };
}

/** The widest reach a person has for a permission, or null. For the screens ("Xem: Cả tổ"). */
export function widestReach(effective: EffectivePermissions, permission: string): Reach | null {
  let widest: Reach | null = null;
  for (const g of effective.grants.get(permission) ?? []) {
    if (!widest || depthRank(g.reach) > depthRank(widest)) widest = g.reach;
  }
  return widest;
}
