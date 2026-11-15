import { rollUpUnits, type RollUpSource } from './backlog-rollup';
import { backlogSheetLines, ROLLED_UP_NOTE } from './processing-backlog.service';

const unit = (teamId: string, parentTeamId: string | null, over: Partial<RollUpSource> = {}): RollUpSource => ({
  teamId,
  teamName: teamId,
  parentTeamId,
  holding: 0,
  unapplied: 0,
  unappliedByKind: { PETITION: 0, INCIDENT: 0, CASE: 0 },
  OVERDUE: 0,
  RED: 0,
  YELLOW: 0,
  GREEN: 0,
  NONE: 0,
  oldestDueAt: null,
  oldestDays: null,
  ...over,
});

/** A child listed BEFORE its parent, a grandchild, and a top unit that stands alone. */
const rows = [
  unit('to-1', 'doi-1', { holding: 5, OVERDUE: 2, RED: 1, GREEN: 3, NONE: 1, oldestDueAt: '2026-12-01T16:59:59.999Z', oldestDays: 9 }),
  unit('doi-1', null, { holding: 2, OVERDUE: 1, YELLOW: 1, NONE: 2, unapplied: 4, unappliedByKind: { PETITION: 1, INCIDENT: 0, CASE: 3 }, oldestDueAt: '2026-12-08T16:59:59.999Z', oldestDays: 2 }),
  unit('nhom-a', 'to-1', { holding: 3, RED: 4, unapplied: 3, unappliedByKind: { PETITION: 2, INCIDENT: 1, CASE: 0 } }),
  unit('doi-2', null, { holding: 4, GREEN: 4 }),
];

describe('the backlog table rolled up to its top units', () => {
  it('sums the band columns of a top unit and everything under it, at any depth', () => {
    const rolled = rollUpUnits(rows);
    expect(rolled.map((row) => row.teamId)).toEqual(['doi-1', 'doi-2']);
    // Computed here, independently: own + child + grandchild.
    expect(rolled[0]).toMatchObject({ descendants: 2, OVERDUE: 1 + 2 + 0, RED: 0 + 1 + 4, YELLOW: 1, GREEN: 3, NONE: 2 + 1 });
    expect(rolled[1]).toMatchObject({ descendants: 0, GREEN: 4 });
  });

  it('never sums `holding`: a group gives the largest figure of one unit, marked as a lower bound', () => {
    const [group, alone] = rollUpUnits(rows);
    expect(group).toMatchObject({ holding: 5, holdingIsLowerBound: true });
    expect(alone).toMatchObject({ holding: 4, holdingIsLowerBound: false });
  });

  it('SUMS `unapplied`, in all and per kind: a record with no flow is held by one unit only', () => {
    const [group, alone] = rollUpUnits(rows);
    expect(group).toMatchObject({ unapplied: 4 + 0 + 3, unappliedByKind: { PETITION: 1 + 2, INCIDENT: 1, CASE: 3 } });
    expect(alone).toMatchObject({ unapplied: 0, unappliedByKind: { PETITION: 0, INCIDENT: 0, CASE: 0 } });
    // The source rows keep their own figures.
    expect(rows[1]).toMatchObject({ unapplied: 4, unappliedByKind: { PETITION: 1, INCIDENT: 0, CASE: 3 } });
  });

  it('keeps the earliest deadline of the group, with its days', () => {
    expect(rollUpUnits(rows)[0]).toMatchObject({ oldestDueAt: '2026-12-01T16:59:59.999Z', oldestDays: 9 });
    expect(rollUpUnits(rows)[1]).toMatchObject({ oldestDueAt: null, oldestDays: null });
  });

  it('a unit whose parent is not in the table is a top unit, a cycle loses no figure, and the source rows are not changed', () => {
    expect(rollUpUnits([unit('to-9', 'doi-hidden', { RED: 2 })])).toMatchObject([{ teamId: 'to-9', descendants: 0, RED: 2 }]);
    const cycle = rollUpUnits([unit('a', 'b', { RED: 1 }), unit('b', 'a', { RED: 2 })]);
    expect(cycle.reduce((sum, row) => sum + row.RED, 0)).toBe(3);
    rollUpUnits(rows);
    expect(rows[1]).toMatchObject({ holding: 2, OVERDUE: 1 });
  });
});

describe('the lines of the exported sheet', () => {
  const totals = { holding: 11, unapplied: 7, OVERDUE: 3, RED: 5, YELLOW: 1, GREEN: 7, NONE: 3 };

  it('rolled up, writes what the screen shows: the top units, the sums, `holding` as "≥ N", and a note', () => {
    const lines = backlogSheetLines({ asOf: '2026-12-10T03:00:00.000Z', rows: rollUpUnits(rows), totals }, true);
    expect(lines).toEqual([
      ['doi-1', '≥ 5', 3, 5, 1, 3, 3, 7, '2026-12-01T16:59:59.999Z', 9],
      ['doi-2', 4, 0, 0, 0, 4, 0, 0, '', ''],
      ['Tổng cộng', 11, 3, 5, 1, 7, 3, 7, '', ''],
      [ROLLED_UP_NOTE],
    ]);
    expect(ROLLED_UP_NOTE).toMatch(/gộp/i);
  });

  it('not rolled up, writes one line per unit with its own figures and no note', () => {
    const lines = backlogSheetLines({ asOf: '2026-12-10T03:00:00.000Z', rows, totals }, false);
    expect(lines.map((line) => line[0])).toEqual(['to-1', 'doi-1', 'nhom-a', 'doi-2', 'Tổng cộng']);
    expect(lines[1]).toEqual(['doi-1', 2, 1, 0, 1, 0, 2, 4, '2026-12-08T16:59:59.999Z', 2]);
  });
});
