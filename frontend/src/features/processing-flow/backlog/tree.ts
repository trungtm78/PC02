/**
 * The units of a table as a tree (by `parentTeamId`). The roll-up to the top units is NOT done here: the server does
 * it (`backend/src/processing-flow/tracking/backlog-rollup.ts`), for the screen and for the export alike.
 */

export interface TreeRow<T> {
  row: T;
  /** 0 at the top; a unit whose parent is not in the table (outside the person's reach) is a top unit too. */
  depth: number;
}

interface Node {
  teamId: string;
  parentTeamId: string | null;
}

/** Parents before their children, siblings in the order the server sent them. */
export function treeOrder<T extends Node>(rows: readonly T[]): TreeRow<T>[] {
  const ids = new Set(rows.map((r) => r.teamId));
  const children = new Map<string, T[]>();
  const top: T[] = [];
  for (const row of rows) {
    const parent = row.parentTeamId;
    if (parent !== null && parent !== row.teamId && ids.has(parent)) children.set(parent, [...(children.get(parent) ?? []), row]);
    else top.push(row);
  }
  const out: TreeRow<T>[] = [];
  const seen = new Set<string>();
  const walk = (row: T, depth: number) => {
    if (seen.has(row.teamId)) return;
    seen.add(row.teamId);
    out.push({ row, depth });
    for (const child of children.get(row.teamId) ?? []) walk(child, depth + 1);
  };
  top.forEach((row) => walk(row, 0));
  // A cycle among parents has no top unit: its rows are still shown, at the top, rather than dropped.
  rows.forEach((row) => walk(row, 0));
  return out;
}
