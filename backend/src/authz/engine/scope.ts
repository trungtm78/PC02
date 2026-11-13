import { TEAM_TREE_MAX_DEPTH } from '../../teams/team-tree.constants';
import type { EffectivePermissions, OrgSnapshot, RecordScope } from './types';

/**
 * The active teams under a team (the team itself not included), as deep as `TeamsService.getDescendantIds` goes
 * today and no deeper: "as today" must not quietly reach a level it never reached. Inactive branches are not entered.
 */
export function activeDescendants(org: OrgSnapshot, teamId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>([teamId]);
  const walk = (id: string, depth: number) => {
    if (depth >= TEAM_TREE_MAX_DEPTH) return;
    for (const child of org.children.get(id) ?? []) {
      if (seen.has(child) || !org.teams.get(child)?.active) continue;
      seen.add(child);
      out.push(child);
      walk(child, depth + 1);
    }
  };
  walk(teamId, 0);
  return out;
}

const membersOf = (org: OrgSnapshot, teamIds: Iterable<string>): Set<string> => {
  const users = new Set<string>();
  for (const id of teamIds) for (const u of org.members.get(id) ?? []) users.add(u);
  return users;
};

/**
 * How far one permission reaches over records, for one person.
 *
 * The four reaches stay apart on purpose. "The team's records OR its members' records" is what TEAM_TREE means
 * (today's behaviour); if OWN or TEAM were folded into that, a member of A handling a record assigned to B would make
 * it visible to all of A, and unassigned records would leak to people limited to their own.
 *
 * `write` adds the data access grants that allow changing (WRITE); reading takes READ and WRITE grants. Grants and
 * the dispatcher flag are additions kept exactly as they work today.
 */
export function recordScope(
  org: OrgSnapshot,
  effective: EffectivePermissions,
  permission: string,
  operation: 'read' | 'write',
): RecordScope {
  if (effective.admin) return { all: true };
  const grants = effective.grants.get(permission) ?? [];
  if (grants.some((g) => g.reach === 'ALL')) return { all: true };

  const exact = new Set<string>();
  const treeTeams = new Set<string>();
  let own = false;
  let tree = false;
  for (const g of grants) {
    // A grant with no team of its own (a personal grant) is measured from every team of the person.
    const from = g.teamId ? [g.teamId] : effective.activeTeamIds;
    if (g.reach === 'OWN') own = true;
    if (g.reach === 'TEAM') for (const t of from) exact.add(t);
    if (g.reach === 'TEAM_TREE') {
      tree = true;
      for (const t of from) {
        treeTeams.add(t);
        for (const d of activeDescendants(org, t)) treeTeams.add(d);
      }
    }
  }
  // Data access grants extend whatever the person may do with records at all: the granted team's records and its
  // members' records. They give nothing to someone with no grant for the permission, and they never bring the
  // unassigned records with them: those come only with a TEAM_TREE grant.
  const granted = new Set<string>();
  if (grants.length > 0) {
    for (const g of effective.dataGrants) if (operation === 'read' || g.level === 'WRITE') granted.add(g.teamId);
  }
  if (!tree && granted.size === 0) return { all: false, own, exactTeamIds: [...exact], tree: null };

  const teams = new Set([...treeTeams, ...granted]);
  const users = membersOf(org, teams);
  users.add(effective.userId);
  return {
    all: false,
    own,
    exactTeamIds: [...exact].filter((t) => !teams.has(t)),
    tree: {
      teamIds: [...teams],
      userIds: [...users],
      // Unassigned records: only "as today" brings them, never for a ward officer, and (as today) only for someone
      // who reaches at least one team.
      includeUnassigned: tree && teams.size > 0 && effective.wardTeamId === null,
    },
  };
}

/**
 * Whether having a permission is about seeing records or about changing them: which data access grants extend it
 * (READ grants extend only seeing).
 */
export function operationOf(permission: string): 'read' | 'write' {
  const action = permission.slice(0, permission.indexOf(':'));
  return ['read', 'read_sensitive', 'export_full', 'download'].includes(action) ? 'read' : 'write';
}

/** The shape today's filters take (`DataScope` of UnitScopeService). */
export interface LegacyScope {
  teamIds: string[];
  userIds: string[];
  writableTeamIds: string[];
  writableUserIds: string[];
  canDispatch: boolean;
  isWardOfficer: boolean;
  wardTeamId: string | null;
}

/**
 * The read and write scope of a permission pair in the shape the existing filters understand, or `null` for
 * "unrestricted". Only a scope made of "as today" parts can be said this way: one that has OWN or TEAM parts answers
 * `undefined`, and the caller must use the precise scope instead of silently widening it.
 */
export function toLegacyScope(effective: EffectivePermissions, read: RecordScope, write: RecordScope): LegacyScope | null | undefined {
  if (read.all && write.all) return null;
  if (read.all || write.all) return undefined;
  if (read.own || write.own || read.exactTeamIds.length || write.exactTeamIds.length) return undefined;
  return {
    teamIds: read.tree?.teamIds ?? [],
    userIds: read.tree?.userIds ?? [effective.userId],
    writableTeamIds: write.tree?.teamIds ?? [],
    writableUserIds: write.tree?.userIds ?? [effective.userId],
    canDispatch: effective.canDispatch,
    isWardOfficer: effective.wardTeamId !== null,
    wardTeamId: effective.wardTeamId,
  };
}
