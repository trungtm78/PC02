/**
 * Pure rules of "the criteria matrix as an Excel file": reading the reasons a file was refused, and saying per team
 * what a read file would change. No React, no network.
 */
import type { CriteriaMatrixError, CriteriaMatrixTeamResult } from '../types';

const isText = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isRow = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function toMatrixError(value: unknown): CriteriaMatrixError | null {
  if (value === null || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  switch (v.code) {
    case 'MATRIX_NOT_RECOGNISED':
    case 'MATRIX_TOO_LARGE':
      return { code: v.code };
    case 'MATRIX_CELL_NOT_PLAIN':
      return isText(v.cell) ? { code: v.code, cell: v.cell } : null;
    case 'MATRIX_CRITERION_DUPLICATE':
    case 'MATRIX_CRITERION_UNKNOWN':
      return isRow(v.row) ? { code: v.code, row: v.row } : null;
    case 'MATRIX_CRITERION_MISSING':
      return isText(v.itemKey) ? { code: v.code, itemKey: v.itemKey } : null;
    case 'MATRIX_TEAM_DUPLICATE':
    case 'MATRIX_TEAM_UNKNOWN':
      return isText(v.column) ? { code: v.code, column: v.column } : null;
    case 'MATRIX_TEAM_MISSING':
    case 'MATRIX_TEAM_EMPTY':
      return isText(v.teamId) ? { code: v.code, teamId: v.teamId, name: isText(v.name) ? v.name : v.teamId } : null;
    default:
      return null;
  }
}

/**
 * The reasons of a `CRITERIA_MATRIX_INVALID` refusal. `extractApiError` hands object details over as JSON text, one
 * per message: each is parsed back here. Anything that is not a known reason (plain words, a code this screen does
 * not know, a reason missing its particulars) is left out, so the caller can tell "no reason understood" apart.
 */
export function parseMatrixErrors(messages: readonly string[]): CriteriaMatrixError[] {
  const out: CriteriaMatrixError[] = [];
  for (const message of messages) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      continue;
    }
    const error = toMatrixError(parsed);
    if (error) out.push(error);
  }
  return out;
}

/** One team of a read matrix: how many criteria it gains and loses. */
export interface MatrixTeamChange {
  teamId: string;
  name: string;
  added: number;
  removed: number;
  changed: boolean;
}

export interface MatrixPreviewSummary {
  teams: MatrixTeamChange[];
  changedTeams: number;
  /** False when the file says exactly what the report already has: there is nothing to apply. */
  hasChanges: boolean;
}

/** What a read matrix would change, team by team, in the order the server gave them. */
export function summariseMatrixPreview(teams: readonly CriteriaMatrixTeamResult[]): MatrixPreviewSummary {
  const rows = teams.map((t) => ({
    teamId: t.teamId,
    name: t.name,
    added: t.added.length,
    removed: t.removed.length,
    changed: t.added.length > 0 || t.removed.length > 0,
  }));
  const changedTeams = rows.filter((r) => r.changed).length;
  return { teams: rows, changedTeams, hasChanges: changedTeams > 0 };
}
