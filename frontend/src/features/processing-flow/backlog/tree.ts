/**
 * The units of the backlog table as a tree (by `parentTeamId`), and the tree rolled up to its top units.
 *
 * The band columns count pieces of work, each belonging to ONE unit: they add up. `holding` counts distinct RECORDS,
 * and a record may be worked by two units at once: it does NOT add up. A rolled-up row therefore gives `holding` as a
 * lower bound (the largest figure of any single unit under it), never as a sum that could count a record twice.
 */
import { BACKLOG_BANDS, type BacklogUnitRow, type BandCounts } from './types';

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

export interface RolledUpRow extends BandCounts {
  teamId: string;
  teamName: string;
  /** How many units are under this one in the table. 0: the figures are the unit's own. */
  descendants: number;
  /** The unit's own figure when it stands alone; otherwise the largest `holding` of any one unit in the group. */
  holding: number;
  /** `holding` is a lower bound of the group, not its exact figure. */
  holdingIsLowerBound: boolean;
  oldestDueAt: string | null;
  oldestDays: number | null;
}

/** One row per top unit, carrying the sums of everything under it. */
export function rollUp(rows: readonly BacklogUnitRow[]): RolledUpRow[] {
  const out: RolledUpRow[] = [];
  for (const { row, depth } of treeOrder(rows)) {
    if (depth === 0) {
      out.push({
        teamId: row.teamId,
        teamName: row.teamName,
        descendants: 0,
        holding: row.holding,
        holdingIsLowerBound: false,
        oldestDueAt: row.oldestDueAt,
        oldestDays: row.oldestDays,
        OVERDUE: row.OVERDUE,
        RED: row.RED,
        YELLOW: row.YELLOW,
        GREEN: row.GREEN,
        NONE: row.NONE,
      });
      continue;
    }
    const group = out[out.length - 1];
    group.descendants += 1;
    group.holdingIsLowerBound = true;
    group.holding = Math.max(group.holding, row.holding);
    for (const band of BACKLOG_BANDS) group[band] += row[band];
    if (row.oldestDueAt !== null && (group.oldestDueAt === null || Date.parse(row.oldestDueAt) < Date.parse(group.oldestDueAt))) {
      group.oldestDueAt = row.oldestDueAt;
      group.oldestDays = row.oldestDays;
    }
  }
  return out;
}
