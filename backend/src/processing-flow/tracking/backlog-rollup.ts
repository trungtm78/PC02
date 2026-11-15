import { BANDS } from '../contract/processing-codes';
import type { Band } from '../engine/types';

/**
 * THE definition of the backlog table rolled up to its top units ("Gộp lên tổ cha"). The screen and the Excel export
 * both show what this answers: neither does the arithmetic itself.
 *
 * The band columns count pieces of work, each belonging to ONE unit: they add up. `holding` counts distinct RECORDS,
 * and a record may be worked by two units at once: it does NOT add up. A group therefore gives `holding` as a lower
 * bound (the largest figure of any single unit in it), never as a sum that could count a record twice. `unapplied`
 * counts the records with no flow by the ONE unit that holds each of them: it adds up, per kind and in all.
 */
export interface RollUpSource extends Record<Band, number> {
  teamId: string;
  teamName: string;
  parentTeamId: string | null;
  holding: number;
  /** Open records with no flow, held by this unit: a record is held by ONE unit, so this figure sums. */
  unapplied: number;
  unappliedByKind: Record<'PETITION' | 'INCIDENT' | 'CASE', number>;
  oldestDueAt: string | null;
  oldestDays: number | null;
}

export type RolledUp<T extends RollUpSource> = T & {
  /** How many units of the table are summed into this row besides itself. 0: the figures are the unit's own. */
  descendants: number;
  /** `holding` is a lower bound of the group, not its exact figure. */
  holdingIsLowerBound: boolean;
};

/**
 * One row per top unit, in the order the top units come in, carrying the sums of everything under it. A unit whose
 * parent is not in the table (outside the person's reach, or working nothing) is a top unit.
 */
export function rollUpUnits<T extends RollUpSource>(rows: readonly T[]): RolledUp<T>[] {
  const byId = new Map(rows.map((row) => [row.teamId, row]));
  const topOf = (row: T): T => {
    const seen = new Set<string>([row.teamId]);
    let at = row;
    for (;;) {
      const parent = at.parentTeamId === null ? undefined : byId.get(at.parentTeamId);
      if (!parent) return at;
      // A cycle among parents has no top: such a unit stands for itself, so no figure is lost or counted twice.
      if (seen.has(parent.teamId)) return row;
      seen.add(parent.teamId);
      at = parent;
    }
  };

  const groups = new Map<string, RolledUp<T>>();
  for (const row of rows) {
    const top = topOf(row);
    if (!groups.has(top.teamId)) groups.set(top.teamId, { ...top, unappliedByKind: { ...top.unappliedByKind }, descendants: 0, holdingIsLowerBound: false });
  }
  for (const row of rows) {
    const top = topOf(row);
    if (top.teamId === row.teamId) continue;
    const group = groups.get(top.teamId) as RolledUp<RollUpSource>;
    group.descendants += 1;
    group.holdingIsLowerBound = true;
    group.holding = Math.max(group.holding, row.holding);
    for (const band of BANDS) group[band] += row[band];
    group.unapplied += row.unapplied;
    for (const kind of ['PETITION', 'INCIDENT', 'CASE'] as const) group.unappliedByKind[kind] += row.unappliedByKind[kind];
    if (row.oldestDueAt !== null && (group.oldestDueAt === null || Date.parse(row.oldestDueAt) < Date.parse(group.oldestDueAt))) {
      group.oldestDueAt = row.oldestDueAt;
      group.oldestDays = row.oldestDays;
    }
  }
  return [...groups.values()];
}
