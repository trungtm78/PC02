/**
 * Pure rules of "Báo cáo tuỳ chọn": how ticks become the selection the server is sent, and how the teams of a period
 * are drawn as a tree. No React, no network.
 */
import { foldText } from '../criteria/criteria';
import type { TeamDirectoryEntry } from './types';

/**
 * Ticks as the server takes them: the ticked keys in the order shown, followed by the keys the saved report names
 * that this period does not have (they are not on the screen, so they cannot have been unticked: the report keeps
 * them for the periods that do have them).
 *
 * `null` ("all", also what is added later) only when everything on the screen is ticked AND the saved report names
 * nothing that is absent here. A report saved with teams [A, B], opened in a period that only has A, is still
 * [A, B] after A is unticked and ticked again: "everything shown" is not "everything" for a report that was a
 * subset.
 */
export function selectionForPayload(
  ticked: ReadonlySet<string>,
  shownKeys: readonly string[],
  savedKeys: readonly string[] | null = null,
): string[] | null {
  const picked = shownKeys.filter((k) => ticked.has(k));
  const shown = new Set(shownKeys);
  const absentSaved = (savedKeys ?? []).filter((k) => !shown.has(k));
  if (picked.length === shownKeys.length && absentSaved.length === 0) return null;
  return [...picked, ...absentSaved];
}

/** One line of the team picker. */
export interface TeamNode {
  id: string;
  name: string;
  /** False for a parent that is not itself in the period: a heading that ticks the teams under it. */
  inPeriod: boolean;
  depth: number;
  /** The teams of the period this line stands for: itself (when in the period) and everything under it. */
  memberIds: string[];
  hasChildren: boolean;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'vi', { numeric: true });

/**
 * The teams of a period under their parents, flattened in drawing order.
 *
 * `directory` says which team is under which; a parent that is not in the period is kept as a heading only when it
 * gathers at least two lines (a heading over a single team says nothing). With no directory, or teams it does not
 * know, the result is the flat list by name.
 */
export function buildTeamTree(
  periodTeams: ReadonlyArray<{ teamId: string; name: string }>,
  directory: readonly TeamDirectoryEntry[],
): TeamNode[] {
  const known = new Map(directory.map((d) => [d.id, d]));
  const inPeriod = new Map(periodTeams.map((t) => [t.teamId, t.name]));

  // Every team of the period, and every ancestor the directory names (a loop ends the walk).
  const included = new Set(inPeriod.keys());
  for (const id of inPeriod.keys()) {
    const seen = new Set([id]);
    for (let parent = known.get(id)?.parentId ?? null; parent !== null && known.has(parent) && !seen.has(parent); ) {
      seen.add(parent);
      included.add(parent);
      parent = known.get(parent)?.parentId ?? null;
    }
  }
  const children = new Map<string | null, string[]>();
  for (const id of included) {
    const parentId = known.get(id)?.parentId ?? null;
    const parent = parentId !== null && included.has(parentId) && parentId !== id ? parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), id]);
  }
  const nameOf = (id: string) => inPeriod.get(id) || known.get(id)?.name || id;
  const sorted = (ids: readonly string[]) => ids.map((id) => ({ id, name: nameOf(id) })).sort(byName).map((n) => n.id);

  const out: TeamNode[] = [];
  const visited = new Set<string>();
  /** Draws a line and what is under it; returns the period teams it stands for. */
  const draw = (id: string, depth: number): string[] => {
    if (visited.has(id)) return [];
    visited.add(id);
    const kids = sorted(children.get(id) ?? []);
    const own = inPeriod.has(id);
    // A heading over one line only: draw that line in its place.
    if (!own && kids.length === 1) return draw(kids[0], depth);
    const node: TeamNode = { id, name: nameOf(id), inPeriod: own, depth, memberIds: [], hasChildren: kids.length > 0 };
    out.push(node);
    node.memberIds = [...(own ? [id] : []), ...kids.flatMap((kid) => draw(kid, depth + 1))];
    return node.memberIds;
  };
  for (const root of sorted(children.get(null) ?? [])) draw(root, 0);
  // Teams caught in a loop of parents have no root: still drawn, flat.
  for (const id of sorted([...inPeriod.keys()].filter((k) => !visited.has(k)))) draw(id, 0);
  return out;
}

/** The lines whose name holds the query (accents and case ignored), or that stand above one that does. */
export function filterTeamNodes(nodes: readonly TeamNode[], query: string): TeamNode[] {
  const q = foldText(query);
  if (!q) return [...nodes];
  const matches = (n: TeamNode) => foldText(n.name).includes(q);
  return nodes.filter((node, i) => {
    if (matches(node)) return true;
    // The lines under this one follow it, deeper, until the next line at its own depth.
    for (let j = i + 1; j < nodes.length && nodes[j].depth > node.depth; j += 1) {
      if (matches(nodes[j])) return true;
    }
    return false;
  });
}

/** How a line with teams under it is drawn: every team it stands for ticked, none, or some. */
export function nodeState(ticked: ReadonlySet<string>, node: TeamNode): 'all' | 'some' | 'none' {
  const n = node.memberIds.filter((id) => ticked.has(id)).length;
  if (n === 0) return 'none';
  return n === node.memberIds.length ? 'all' : 'some';
}
