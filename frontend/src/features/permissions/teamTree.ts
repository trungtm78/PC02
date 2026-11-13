/** Pure helpers of the team list of "permissions by team". */
import { permissions as L } from '@/locales/permissions.vi';
import { TEAM_MODE, type TeamRow } from './types';

const T = L.teams;

/** The teams as a tree, each with its depth. A team whose parent is not in the list is shown as a root. */
export function flattenTeams(teams: readonly TeamRow[]): { team: TeamRow; depth: number }[] {
  const ids = new Set(teams.map((t) => t.teamId));
  const byParent = new Map<string | null, TeamRow[]>();
  for (const team of teams) {
    const parent = team.parentId && ids.has(team.parentId) && team.parentId !== team.teamId ? team.parentId : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), team]);
  }
  const out: { team: TeamRow; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const team of [...(byParent.get(parent) ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'vi'))) {
      if (seen.has(team.teamId)) continue;
      seen.add(team.teamId);
      out.push({ team, depth });
      walk(team.teamId, depth + 1);
    }
  };
  walk(null, 0);
  // A cycle among parents would leave teams unreached: they are still listed.
  for (const team of teams) if (!seen.has(team.teamId)) out.push({ team, depth: 0 });
  return out;
}

/** Where a team's permissions come from, in a few words. */
export function teamChip(team: TeamRow): { text: string; own: boolean } {
  if (team.config?.mode === TEAM_MODE.EXPLICIT) return { text: T.chipExplicit, own: true };
  if (team.governedByTeamId && team.governedByTeamName) return { text: T.chipInherit(team.governedByTeamName), own: false };
  return { text: T.chipRole, own: false };
}
