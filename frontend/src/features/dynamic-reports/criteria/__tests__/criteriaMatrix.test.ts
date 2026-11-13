import { describe, it, expect } from 'vitest';
import { parseMatrixErrors, summariseMatrixPreview } from '../criteriaMatrix';
import { matrixErrorText, periodCriteriaErrorText, reportCriteria } from '@/locales/reportCriteria.vi';

describe('parseMatrixErrors', () => {
  it('reads every known reason back from the JSON text the error helper hands over', () => {
    const reasons = [
      { code: 'MATRIX_NOT_RECOGNISED' },
      { code: 'MATRIX_CRITERION_UNKNOWN', row: 9 },
      { code: 'MATRIX_CRITERION_MISSING', itemKey: 'tin-moi' },
      { code: 'MATRIX_TEAM_UNKNOWN', column: 'F' },
      { code: 'MATRIX_TEAM_MISSING', teamId: 't1', name: 'Tổ 1' },
      { code: 'MATRIX_TEAM_EMPTY', teamId: 't2', name: 'Tổ 2' },
    ];
    expect(parseMatrixErrors(reasons.map((r) => JSON.stringify(r)))).toEqual(reasons);
  });

  it('leaves out plain words, unknown codes and reasons missing their particulars', () => {
    expect(
      parseMatrixErrors([
        'Validation failed',
        'null',
        JSON.stringify({ code: 'SOMETHING_ELSE' }),
        JSON.stringify({ code: 'MATRIX_CRITERION_UNKNOWN', row: 'nine' }),
        JSON.stringify({ code: 'MATRIX_CRITERION_MISSING' }),
        JSON.stringify({ code: 'MATRIX_TEAM_UNKNOWN', column: '' }),
        JSON.stringify({ code: 'MATRIX_TEAM_EMPTY' }),
      ]),
    ).toEqual([]);
  });

  it('a team reason without a name is named by its id', () => {
    expect(parseMatrixErrors([JSON.stringify({ code: 'MATRIX_TEAM_MISSING', teamId: 't9' })])).toEqual([
      { code: 'MATRIX_TEAM_MISSING', teamId: 't9', name: 't9' },
    ]);
  });
});

describe('summariseMatrixPreview', () => {
  it('counts what each team gains and loses, in the order given', () => {
    const summary = summariseMatrixPreview([
      { teamId: 'a', name: 'A', itemKeys: ['x'], added: [], removed: ['y', 'z'] },
      { teamId: 'b', name: 'B', itemKeys: null, added: ['y'], removed: [] },
      { teamId: 'c', name: 'C', itemKeys: null, added: [], removed: [] },
    ]);
    expect(summary.teams).toEqual([
      { teamId: 'a', name: 'A', added: 0, removed: 2, changed: true },
      { teamId: 'b', name: 'B', added: 1, removed: 0, changed: true },
      { teamId: 'c', name: 'C', added: 0, removed: 0, changed: false },
    ]);
    expect(summary.changedTeams).toBe(2);
    expect(summary.hasChanges).toBe(true);
  });

  it('a file that says what the report already has changes nothing', () => {
    expect(summariseMatrixPreview([{ teamId: 'a', name: 'A', itemKeys: null, added: [], removed: [] }]).hasChanges).toBe(false);
  });
});

describe('the words of a refusal', () => {
  const name = (key: string) => (key === 'tin-moi' ? '1.1 Tin mới' : key);
  const t = reportCriteria.matrix.errors;

  it('each matrix reason has its own sentence, naming the row, column, criterion or team', () => {
    expect(matrixErrorText({ code: 'MATRIX_NOT_RECOGNISED' }, name)).toBe(t.MATRIX_NOT_RECOGNISED);
    expect(matrixErrorText({ code: 'MATRIX_CRITERION_UNKNOWN', row: 9 }, name)).toBe(t.MATRIX_CRITERION_UNKNOWN(9));
    expect(matrixErrorText({ code: 'MATRIX_CRITERION_MISSING', itemKey: 'tin-moi' }, name)).toContain('1.1 Tin mới');
    expect(matrixErrorText({ code: 'MATRIX_TEAM_UNKNOWN', column: 'F' }, name)).toBe(t.MATRIX_TEAM_UNKNOWN('F'));
    expect(matrixErrorText({ code: 'MATRIX_TEAM_MISSING', teamId: 't1', name: 'Tổ 1' }, name)).toBe(t.MATRIX_TEAM_MISSING('Tổ 1'));
    expect(matrixErrorText({ code: 'MATRIX_TEAM_EMPTY', teamId: 't2', name: 'Tổ 2' }, name)).toBe(t.MATRIX_TEAM_EMPTY('Tổ 2'));
  });

  it('a refused mid-period change is said by its code, else by what the server said, else by the fallback', () => {
    expect(periodCriteriaErrorText('SUBMISSION_MUST_BE_RETURNED', 'x')).toBe(reportCriteria.period.errors.SUBMISSION_MUST_BE_RETURNED);
    expect(periodCriteriaErrorText('OTHER', 'Máy chủ nói vậy')).toBe('Máy chủ nói vậy');
    expect(periodCriteriaErrorText(undefined, '')).toBe(reportCriteria.errorFallback);
  });
});
