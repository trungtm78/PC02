/**
 * S20 charts (spec §6.1 PR8 slice 6) — "biểu đồ cột theo đơn vị + xu hướng
 * giữa các kỳ cùng loại". Pure functions over `StatusMatrixView`, already
 * fetched by `StatusMatrixPanel` for the matrix table — no new backend
 * endpoint needed, since the matrix already carries exactly the team ×
 * period × state data both charts need.
 *
 * "Completed" = state SUBMITTED or APPROVED (same rollup `DYN_REPORT_SUBMISSION_STATE_LABEL`
 * groups as "done" elsewhere in this module). A cell with `notAssigned: true`
 * ("Không giao") never counts toward either numerator or denominator —
 * a team not assigned a period isn't "behind", it simply has no obligation.
 */
import type { StatusMatrixView } from '@/features/dynamic-reports/types';

const COMPLETED_STATES = new Set(['SUBMITTED', 'APPROVED']);

export interface TeamBarDatum {
  teamId: string;
  teamName: string;
  completed: number;
  total: number;
  /** 0-100, rounded; `null` when `total` is 0 ("—" in the UI, never divide by zero). */
  rate: number | null;
}

export interface PeriodTrendDatum {
  periodId: string;
  periodKey: string;
  completed: number;
  total: number;
  rate: number | null;
}

/** Bar chart "theo đơn vị" — one bar per team, summed across every period shown. */
export function computeTeamBarData(matrix: StatusMatrixView): TeamBarDatum[] {
  return matrix.teams.map((team) => {
    let completed = 0;
    let total = 0;
    for (const period of matrix.periods) {
      const cell = matrix.cells[team.teamId]?.[period.periodId];
      if (!cell || cell.notAssigned) continue;
      total += 1;
      if (cell.state && COMPLETED_STATES.has(cell.state)) completed += 1;
    }
    return {
      teamId: team.teamId,
      teamName: team.teamName,
      completed,
      total,
      rate: total > 0 ? Math.round((completed / total) * 100) : null,
    };
  });
}

/** Trend line "xu hướng giữa các kỳ" — one point per period, summed across every team. */
export function computePeriodTrendData(matrix: StatusMatrixView): PeriodTrendDatum[] {
  return matrix.periods.map((period) => {
    let completed = 0;
    let total = 0;
    for (const team of matrix.teams) {
      const cell = matrix.cells[team.teamId]?.[period.periodId];
      if (!cell || cell.notAssigned) continue;
      total += 1;
      if (cell.state && COMPLETED_STATES.has(cell.state)) completed += 1;
    }
    return {
      periodId: period.periodId,
      periodKey: period.periodKey,
      completed,
      total,
      rate: total > 0 ? Math.round((completed / total) * 100) : null,
    };
  });
}
