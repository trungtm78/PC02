import { classifyCell } from './classify';

/**
 * Cell classification (spec §3 "Quy tắc ô", §10 R3 PR3 checklist). Four real
 * signals come out of the parser per cell: effective locked/unlocked
 * (locked.ts), whether it holds a formula, whether its raw text parses as a
 * `{TYPE|...}` token (token.ts), and structural flags (merge non-anchor,
 * hidden row/column). This function turns those into one classification +
 * zero-or-more issues — the single place the "unlocked+literal → warn,
 * don't block" decision (spec §3, overriding FRD FR-002) lives.
 */
describe('classifyCell', () => {
  it('locked + no formula + plain text → STATIC_TEXT, no issues', () => {
    const result = classifyCell({
      locked: true,
      hasFormula: false,
      rawValue: 'Tiêu chí',
      isMergeNonAnchor: false,
      isHidden: false,
    });
    expect(result.classification).toBe('STATIC_TEXT');
    expect(result.issues).toHaveLength(0);
  });

  it('locked + formula → STATIC_FORMULA, no issues', () => {
    const result = classifyCell({
      locked: true,
      hasFormula: true,
      rawValue: null,
      isMergeNonAnchor: false,
      isHidden: false,
    });
    expect(result.classification).toBe('STATIC_FORMULA');
    expect(result.issues).toHaveLength(0);
  });

  it('unlocked + valid token → INPUT_FIELD, carries the parsed token, no issues', () => {
    const result = classifyCell({
      locked: false,
      hasFormula: false,
      rawValue: '{NUM|#,##0|SUM}',
      isMergeNonAnchor: false,
      isHidden: false,
    });
    expect(result.classification).toBe('INPUT_FIELD');
    expect(result.field?.type).toBe('NUM');
    expect(result.field?.aggregate).toBe('SUM');
    expect(result.issues).toHaveLength(0);
  });

  it('unlocked + empty value → STATIC_TEXT with an UNLOCKED_NO_TOKEN warning (spec §3: warn, do not block)', () => {
    const result = classifyCell({
      locked: false,
      hasFormula: false,
      rawValue: null,
      isMergeNonAnchor: false,
      isHidden: false,
    });
    expect(result.classification).toBe('STATIC_TEXT');
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'UNLOCKED_NO_TOKEN',
        severity: 'WARNING',
      }),
    ]);
  });

  it('unlocked + sample-number literal → STATIC_TEXT with UNLOCKED_NO_TOKEN warning, sample value is discarded', () => {
    const result = classifyCell({
      locked: false,
      hasFormula: false,
      rawValue: 5,
      isMergeNonAnchor: false,
      isHidden: false,
    });
    expect(result.classification).toBe('STATIC_TEXT');
    expect(result.field).toBeUndefined();
    expect(result.issues[0].code).toBe('UNLOCKED_NO_TOKEN');
  });

  it('unlocked + malformed token text → STATIC_TEXT with UNLOCKED_NO_TOKEN warning (not a hard TOKEN error)', () => {
    const result = classifyCell({
      locked: false,
      hasFormula: false,
      rawValue: '{BOGUS}',
      isMergeNonAnchor: false,
      isHidden: false,
    });
    expect(result.classification).toBe('STATIC_TEXT');
    expect(result.issues[0].code).toBe('UNLOCKED_NO_TOKEN');
  });

  it('locked + text shaped like a token → STATIC_TEXT with a LOCKED_LOOKS_LIKE_TOKEN warning', () => {
    const result = classifyCell({
      locked: true,
      hasFormula: false,
      rawValue: '{NUM|SUM}',
      isMergeNonAnchor: false,
      isHidden: false,
    });
    expect(result.classification).toBe('STATIC_TEXT');
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'LOCKED_LOOKS_LIKE_TOKEN',
        severity: 'WARNING',
      }),
    ]);
  });

  it('unlocked + valid token but on a hidden row/column → ERROR, still reports the field so the wizard can show it crossed out', () => {
    const result = classifyCell({
      locked: false,
      hasFormula: false,
      rawValue: '{NUM}',
      isMergeNonAnchor: false,
      isHidden: true,
    });
    expect(result.classification).toBe('INPUT_FIELD');
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'HIDDEN_INPUT_CELL', severity: 'ERROR' }),
    ]);
  });

  it('a merge non-anchor cell is always STATIC_TEXT regardless of its (usually null) value — anchor carries the field', () => {
    const result = classifyCell({
      locked: false,
      hasFormula: false,
      rawValue: '{NUM}',
      isMergeNonAnchor: true,
      isHidden: false,
    });
    expect(result.classification).toBe('STATIC_TEXT');
    expect(result.issues).toHaveLength(0);
  });

  it('formula takes classification priority over a token-shaped literal (a formula cell cannot also be an input)', () => {
    const result = classifyCell({
      locked: false,
      hasFormula: true,
      rawValue: '{NUM}',
      isMergeNonAnchor: false,
      isHidden: false,
    });
    expect(result.classification).toBe('STATIC_FORMULA');
    expect(result.issues).toHaveLength(0);
  });
});
