import { describe, it, expect } from 'vitest';
import { computeTeamBarData, computePeriodTrendData } from '../statusChartData';
import type { StatusMatrixView } from '@/features/dynamic-reports/types';

function cell(overrides: Partial<StatusMatrixView['cells']['x']['y']> = {}) {
  return {
    notAssigned: false,
    state: 'NOT_STARTED' as const,
    accessState: 'OPEN' as const,
    timelinessState: 'NOT_YET_DUE' as const,
    exempt: false,
    dueAt: '2026-07-05T17:00:00.000Z',
    ...overrides,
  };
}

const MATRIX: StatusMatrixView = {
  periods: [
    { periodId: 'p1', periodKey: '2026-05', dueAt: '2026-06-05T17:00:00.000Z' },
    { periodId: 'p2', periodKey: '2026-06', dueAt: '2026-07-05T17:00:00.000Z' },
  ],
  teams: [
    { teamId: 'team1', teamName: 'Đội 1' },
    { teamId: 'team2', teamName: 'Đội 2' },
  ],
  cells: {
    team1: {
      p1: cell({ state: 'APPROVED' }),
      p2: cell({ state: 'SUBMITTED' }),
    },
    team2: {
      p1: cell({ notAssigned: true, state: null }),
      p2: cell({ state: 'NOT_STARTED' }),
    },
  },
  asOf: '2026-07-01T10:00:00.000Z',
};

describe('computeTeamBarData', () => {
  it('sums completed/total across every period, skipping notAssigned cells', () => {
    const result = computeTeamBarData(MATRIX);

    expect(result).toEqual([
      { teamId: 'team1', teamName: 'Đội 1', completed: 2, total: 2, rate: 100 },
      { teamId: 'team2', teamName: 'Đội 2', completed: 0, total: 1, rate: 0 },
    ]);
  });

  it('returns rate=null (never divides by zero) when a team has no assigned periods at all', () => {
    const allNotAssigned: StatusMatrixView = {
      ...MATRIX,
      cells: {
        team1: { p1: cell({ notAssigned: true, state: null }), p2: cell({ notAssigned: true, state: null }) },
        team2: { p1: cell({ notAssigned: true, state: null }), p2: cell({ notAssigned: true, state: null }) },
      },
    };

    const result = computeTeamBarData(allNotAssigned);

    expect(result[0].total).toBe(0);
    expect(result[0].rate).toBeNull();
  });
});

describe('computePeriodTrendData', () => {
  it('sums completed/total across every team for each period, skipping notAssigned cells', () => {
    const result = computePeriodTrendData(MATRIX);

    expect(result).toEqual([
      { periodId: 'p1', periodKey: '2026-05', completed: 1, total: 1, rate: 100 },
      { periodId: 'p2', periodKey: '2026-06', completed: 1, total: 2, rate: 50 },
    ]);
  });

  it('returns rate=null for a period where every team is notAssigned', () => {
    const noOneAssigned: StatusMatrixView = {
      ...MATRIX,
      periods: [{ periodId: 'p3', periodKey: '2026-07', dueAt: '2026-08-05T17:00:00.000Z' }],
      cells: {
        team1: { p3: cell({ notAssigned: true, state: null }) },
        team2: { p3: cell({ notAssigned: true, state: null }) },
      },
    };

    const result = computePeriodTrendData(noOneAssigned);

    expect(result).toEqual([{ periodId: 'p3', periodKey: '2026-07', completed: 0, total: 0, rate: null }]);
  });
});
