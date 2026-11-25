import type { PrismaClient } from '@prisma/client';
import { MOVED_RECORD_TABLES } from './pc02-unit-chart';

/**
 * How many petitions, incidents and cases a person can READ, computed WITHOUT the permission engine: the reaches are
 * restated here from their specification (prisma/permission-resources.ts) and the records are counted by SQL written
 * for this purpose. The CLI prints these counts before and after the change, and after a real run compares them with
 * what the engine itself lets through: a bug in the engine (or here) shows as a difference, not as a quiet surprise.
 *
 *   ADMIN       every record
 *   canDispatch every record (a dispatcher reads across units, decision of 19/09/2026)
 *   OWN         records the person owns (petitions: entered by; incidents and cases: the investigator)
 *   TEAM        records assigned to exactly the team that grants it
 *   TEAM_OWN    TEAM and OWN together
 *   TEAM_TREE   the team and its active teams below (3 levels), records owned by any member of those teams or by the
 *               person, and unassigned records unless the person sits in a ward unit
 *   ALL         every record
 * A team with no configuration of its own follows the nearest team above it that has one; with none up the line, a
 * person keeps what their role holds, at TEAM_TREE. A person in no active team keeps the role over their own records.
 * Data access grants add the granted team and its members' records (never unassigned ones).
 */

export const ORACLE_SUBJECTS = [
  { key: 'petitions', permission: 'read:Petition' },
  { key: 'incidents', permission: 'read:Incident' },
  { key: 'cases', permission: 'read:Case' },
] as const;
export type OracleSubject = (typeof ORACLE_SUBJECTS)[number]['key'];

const TREE_DEPTH = 3;
const MAX_UP = 50;

export interface OracleOverride {
  permission: string;
  effect: 'GRANT' | 'MUTE';
  reach: string | null;
  expiresAt: Date | null;
}
export interface OracleState {
  teams: ReadonlyMap<string, { name: string; parentId: string | null; active: boolean; wardId: string | null }>;
  memberships: readonly { userId: string; teamId: string; isLeader: boolean }[];
  users: ReadonlyMap<string, { username: string; roleName: string; rolePermissions: ReadonlySet<string>; canDispatch: boolean; isActive: boolean }>;
  configs: ReadonlyMap<
    string,
    { mode: 'INHERIT' | 'EXPLICIT'; memberTemplateId: string | null; leaderTemplateId: string | null; overrides: readonly (OracleOverride & { audience: 'ALL' | 'MEMBER' | 'LEADER' })[] }
  >;
  templates: ReadonlyMap<string, ReadonlyMap<string, string>>;
  userOverrides: ReadonlyMap<string, readonly OracleOverride[]>;
  dataGrants: ReadonlyMap<string, readonly { teamId: string; level: 'READ' | 'WRITE'; expiresAt: Date | null }[]>;
}

/** What a person can read of one subject: everything, or the records matching any of the three parts. */
export type Readable =
  | { all: true; why: 'ADMIN' | 'DISPATCH' | 'ALL' }
  | { all: false; owners: string[]; teams: string[]; unassigned: boolean };

const alive = (expiresAt: Date | null, now: Date) => expiresAt === null || expiresAt.getTime() > now.getTime();

/** The reach one membership gives for a permission, or null. */
function reachOfMembership(state: OracleState, userId: string, m: { teamId: string; isLeader: boolean }, permission: string, now: Date): string | null {
  const user = state.users.get(userId)!;
  let governing: string | null = null;
  const seen = new Set<string>();
  for (let id: string | null = m.teamId, n = 0; id && !seen.has(id) && n < MAX_UP; n += 1) {
    seen.add(id);
    if (state.configs.get(id)?.mode === 'EXPLICIT') {
      governing = id;
      break;
    }
    id = state.teams.get(id)?.parentId ?? null;
  }
  if (!governing) return user.rolePermissions.has(permission) ? 'TEAM_TREE' : null;
  const config = state.configs.get(governing)!;
  const templateId = (m.isLeader && config.leaderTemplateId) || config.memberTemplateId;
  let reach: string | null = (templateId && state.templates.get(templateId)?.get(permission)) || null;
  const mine = config.overrides.filter((o) => o.permission === permission && alive(o.expiresAt, now) && (o.audience === 'ALL' || (o.audience === 'LEADER') === m.isLeader));
  for (const o of mine) if (o.effect === 'GRANT' && o.reach) reach = o.reach;
  if (mine.some((o) => o.effect === 'MUTE')) reach = null;
  return reach;
}

function activeTreeOf(state: OracleState, teamId: string): string[] {
  const out = [teamId];
  let level = [teamId];
  for (let depth = 0; depth < TREE_DEPTH; depth += 1) {
    const next: string[] = [];
    for (const [id, t] of state.teams) if (t.parentId && level.includes(t.parentId) && t.active && !out.includes(id)) next.push(id);
    out.push(...next);
    level = next;
  }
  return out;
}

/** What `userId` can read of the records `permission` is about. Null: the account cannot sign in (inactive). */
export function readableBy(state: OracleState, userId: string, permission: string, now: Date = new Date()): Readable | null {
  const user = state.users.get(userId);
  if (!user || !user.isActive) return null;
  if (user.roleName === 'ADMIN') return { all: true, why: 'ADMIN' };
  if (user.canDispatch) return { all: true, why: 'DISPATCH' };

  const memberships = state.memberships.filter((m) => m.userId === userId && state.teams.get(m.teamId)?.active);
  const given: { reach: string; from: string[] }[] = [];
  if (memberships.length === 0) {
    if (user.rolePermissions.has(permission)) given.push({ reach: 'TEAM_TREE', from: [] });
  }
  for (const m of memberships) {
    const reach = reachOfMembership(state, userId, m, permission, now);
    if (reach) given.push({ reach, from: [m.teamId] });
  }
  const personal = (state.userOverrides.get(userId) ?? []).filter((o) => o.permission === permission && alive(o.expiresAt, now));
  for (const o of personal) if (o.effect === 'GRANT' && o.reach) given.push({ reach: o.reach, from: memberships.map((m) => m.teamId) });
  if (personal.some((o) => o.effect === 'MUTE')) given.length = 0;
  if (given.length === 0) return { all: false, owners: [], teams: [], unassigned: false };
  if (given.some((g) => g.reach === 'ALL')) return { all: true, why: 'ALL' };

  const owners = new Set<string>();
  const teams = new Set<string>();
  const treeTeams = new Set<string>();
  let tree = false;
  for (const g of given) {
    if (g.reach === 'OWN' || g.reach === 'TEAM_OWN') owners.add(userId);
    if (g.reach === 'TEAM' || g.reach === 'TEAM_OWN') for (const t of g.from) teams.add(t);
    if (g.reach === 'TEAM_TREE') {
      tree = true;
      for (const t of g.from) for (const d of activeTreeOf(state, t)) treeTeams.add(d);
    }
  }
  const granted = (state.dataGrants.get(userId) ?? []).filter((g) => alive(g.expiresAt, now) && state.teams.get(g.teamId)?.active).map((g) => g.teamId);
  const reachedAsWhole = new Set([...treeTeams, ...granted]);
  if (tree || granted.length > 0) {
    owners.add(userId);
    for (const m of state.memberships) if (reachedAsWhole.has(m.teamId)) owners.add(m.userId);
  }
  for (const t of reachedAsWhole) teams.add(t);
  const inWard = memberships.some((m) => state.teams.get(m.teamId)?.wardId != null);
  return { all: false, owners: [...owners].sort(), teams: [...teams].sort(), unassigned: tree && reachedAsWhole.size > 0 && !inWard };
}

/**
 * The number of records of `subject` (not deleted) that `readable` lets through. `remap` counts records assigned to
 * `from` as if they were assigned to `to` (the state after the move, before it is made).
 */
export async function countReadable(db: PrismaClient, subject: OracleSubject, readable: Readable, remap: { from: string; to: string } | null = null): Promise<number> {
  const table = MOVED_RECORD_TABLES.find((t) => t.table === subject)!;
  if (readable.all) {
    const rows = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${table.table}" WHERE "deletedAt" IS NULL`);
    return Number(rows[0].n);
  }
  const rows = await db.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM "${table.table}" r
      WHERE r."deletedAt" IS NULL
        AND (r."${table.owner}" = ANY($1::text[])
             OR (CASE WHEN r."assignedTeamId" = $3::text THEN $4::text ELSE r."assignedTeamId" END) = ANY($2::text[])
             OR ($5::boolean AND r."assignedTeamId" IS NULL))`,
    readable.owners,
    readable.teams,
    remap?.from ?? null,
    remap?.to ?? null,
    readable.unassigned,
  );
  return Number(rows[0].n);
}

export type ReadCounts = Record<OracleSubject, number | 'ALL'> & { why?: string };

/** The three counts for a person; `null` when the account cannot sign in. Everything readable is said `ALL`. */
export async function readCounts(db: PrismaClient, state: OracleState, userId: string, remap: { from: string; to: string } | null, now = new Date()): Promise<{ counts: Record<OracleSubject, number>; all: string | null } | null> {
  const counts = {} as Record<OracleSubject, number>;
  let all: string | null = null;
  for (const s of ORACLE_SUBJECTS) {
    const r = readableBy(state, userId, s.permission, now);
    if (!r) return null;
    if (r.all) all = r.why;
    counts[s.key] = await countReadable(db, s.key, r, remap);
  }
  return { counts, all };
}

const pair = (p: { action: string; subject: string }) => `${p.action}:${p.subject}`;

/** The state as the database has it now. */
export async function loadOracleState(db: PrismaClient): Promise<OracleState> {
  const [teams, memberships, users, configs, templates, overrides, grants] = await Promise.all([
    db.team.findMany({ select: { id: true, name: true, parentId: true, status: true, wardId: true } }),
    db.userTeam.findMany({ select: { userId: true, teamId: true, isLeader: true } }),
    db.user.findMany({
      select: { id: true, username: true, isActive: true, canDispatch: true, role: { select: { name: true, permissions: { select: { permission: { select: { action: true, subject: true } } } } } } },
    }),
    db.teamPermissionConfig.findMany({ include: { overrides: { include: { permission: { select: { action: true, subject: true } } } } } }),
    db.permissionTemplate.findMany({ select: { id: true, entries: { select: { reach: true, permission: { select: { action: true, subject: true } } } } } }),
    db.userPermissionOverride.findMany({ include: { permission: { select: { action: true, subject: true } } } }),
    db.dataAccessGrant.findMany({ select: { granteeId: true, teamId: true, accessLevel: true, expiresAt: true } }),
  ]);
  const group = <T>(rows: T[], key: (r: T) => string) => {
    const out = new Map<string, T[]>();
    for (const r of rows) out.set(key(r), [...(out.get(key(r)) ?? []), r]);
    return out;
  };
  return {
    teams: new Map(teams.map((t) => [t.id, { name: t.name, parentId: t.parentId, active: t.status === 'ACTIVE', wardId: t.wardId }])),
    memberships,
    users: new Map(
      users.map((u) => [u.id, { username: u.username, roleName: u.role.name, rolePermissions: new Set(u.role.permissions.map((p) => pair(p.permission))), canDispatch: u.canDispatch, isActive: u.isActive }]),
    ),
    configs: new Map(
      configs.map((c) => [
        c.teamId,
        {
          mode: c.mode,
          memberTemplateId: c.memberTemplateId,
          leaderTemplateId: c.leaderTemplateId,
          overrides: c.overrides.map((o) => ({ permission: pair(o.permission), effect: o.effect, reach: o.reach, expiresAt: o.expiresAt, audience: o.audience })),
        },
      ]),
    ),
    templates: new Map(templates.map((t) => [t.id, new Map(t.entries.map((e) => [pair(e.permission), e.reach as string]))])),
    userOverrides: new Map([...group(overrides, (o) => o.userId)].map(([k, v]) => [k, v.map((o) => ({ permission: pair(o.permission), effect: o.effect, reach: o.reach, expiresAt: o.expiresAt }))])),
    dataGrants: new Map([...group(grants, (g) => g.granteeId)].map(([k, v]) => [k, v.map((g) => ({ teamId: g.teamId, level: g.accessLevel, expiresAt: g.expiresAt }))])),
  };
}
