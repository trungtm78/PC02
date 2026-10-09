import { parseToken, TYPE_AGGREGATE_COMPATIBILITY } from './token';

/**
 * Token engine — parses the `{TYPE|FORMAT|AGG}` grammar used in unlocked
 * cells (FRD §4.4). Pure, no I/O. Shared with the frontend (spec §10 R2) so
 * the setup wizard's live preview and the server's publish-time validation
 * agree on every token without duplicating the grammar.
 */
describe('parseToken — valid combinations', () => {
  it('parses a bare {TYPE}', () => {
    const result = parseToken('{NUM}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token).toEqual({
        type: 'NUM',
        format: '',
        aggregate: 'NONE',
        warnings: [],
      });
    }
  });

  it('parses {TYPE|FORMAT}', () => {
    const result = parseToken('{NUM|#,##0}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.token.format).toBe('#,##0');
  });

  it('parses {TYPE|FORMAT|AGG}', () => {
    const result = parseToken('{NUM|#,##0|SUM}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token).toEqual({
        type: 'NUM',
        format: '#,##0',
        aggregate: 'SUM',
        warnings: [],
      });
    }
  });

  it('allows an empty format with an aggregate: {NUM||SUM}', () => {
    const result = parseToken('{NUM||SUM}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token.format).toBe('');
      expect(result.token.aggregate).toBe('SUM');
    }
  });

  it('trims whitespace OUTSIDE the token but keeps format content verbatim', () => {
    const result = parseToken('  {NUM|#,##0.00|AVG}  ');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.token.format).toBe('#,##0.00');
  });

  it('type and aggregate are case-insensitive and normalized to uppercase', () => {
    const result = parseToken('{num|#,##0|sum}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token.type).toBe('NUM');
      expect(result.token.aggregate).toBe('SUM');
    }
  });

  it('normalizes the "Num" typo to NUM without a warning (ordinary case folding)', () => {
    const result = parseToken('{Num|#,##0}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token.type).toBe('NUM');
      expect(result.token.warnings).toEqual([]);
    }
  });

  it('accepts AGV as an alias for AVG, normalizes to AVG, and emits a warning (FRD §4.4)', () => {
    const result = parseToken('{NUM|#,##0|AGV}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token.aggregate).toBe('AVG');
      expect(result.token.warnings).toHaveLength(1);
      expect(result.token.warnings[0].code).toBe('AGV_ALIAS_NORMALIZED');
      expect(result.token.warnings[0].message.includes('AVG')).toBe(true);
    }
  });

  it('accepts all four types with NONE aggregate', () => {
    for (const type of ['NUM', 'TEXT', 'DATE', 'TIME']) {
      const result = parseToken(`{${type}}`);
      expect(result.ok).toBe(true);
    }
  });

  it('parses a DATE format token', () => {
    const result = parseToken('{DATE|dd/mm/yyyy}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token.type).toBe('DATE');
      expect(result.token.format).toBe('dd/mm/yyyy');
    }
  });

  it('parses a TIME format token', () => {
    const result = parseToken('{TIME|hh:mm}');
    expect(result.ok).toBe(true);
  });
});

describe('parseToken — invalid input', () => {
  it('rejects a cell that is not a token at all', () => {
    const result = parseToken('125');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_A_TOKEN');
  });

  it('rejects an empty string', () => {
    const result = parseToken('');
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown type', () => {
    const result = parseToken('{FOO}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN_TYPE');
  });

  it('rejects an unknown aggregate (not a recognized value or the AGV alias)', () => {
    const result = parseToken('{NUM|#,##0|TOTAL}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN_AGGREGATE');
  });

  it('rejects more than 3 pipe-separated parts', () => {
    const result = parseToken('{NUM|#,##0|SUM|extra}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOO_MANY_PARTS');
  });

  it('rejects content before the token (token must occupy the whole cell)', () => {
    const result = parseToken('Label: {NUM}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOKEN_NOT_WHOLE_CELL');
  });

  it('rejects content after the token', () => {
    const result = parseToken('{NUM} total');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOKEN_NOT_WHOLE_CELL');
  });

  it('rejects a pipe embedded inside the format segment (v1 limitation, FRD §4.4)', () => {
    // Can't distinguish "format contains a literal pipe" from "a 4th part was
    // intended" in v1 — same failure mode as TOO_MANY_PARTS, reported
    // consistently.
    const result = parseToken('{NUM|#,##0|x|SUM}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOO_MANY_PARTS');
  });

  it('rejects SUM aggregate on TEXT (AGGREGATE_TYPE_MISMATCH)', () => {
    const result = parseToken('{TEXT||SUM}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGGREGATE_TYPE_MISMATCH');
  });

  it('rejects SUM aggregate on DATE', () => {
    const result = parseToken('{DATE|dd/mm/yyyy|SUM}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGGREGATE_TYPE_MISMATCH');
  });

  it('rejects AVG aggregate on TIME', () => {
    const result = parseToken('{TIME|hh:mm|AVG}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGGREGATE_TYPE_MISMATCH');
  });

  it('allows NONE aggregate explicitly on TEXT/DATE/TIME', () => {
    expect(parseToken('{TEXT||NONE}').ok).toBe(true);
    expect(parseToken('{DATE|dd/mm/yyyy|NONE}').ok).toBe(true);
    expect(parseToken('{TIME|hh:mm|NONE}').ok).toBe(true);
  });

  it('rejects nested braces inside an otherwise well-formed wrapper', () => {
    const result = parseToken('{NUM{X}}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_A_TOKEN');
  });

  it('rejects unbalanced braces', () => {
    expect(parseToken('{NUM').ok).toBe(false);
    expect(parseToken('NUM}').ok).toBe(false);
  });
});

describe('TYPE_AGGREGATE_COMPATIBILITY (used by the setup UI to grey out invalid combinations)', () => {
  it('lists SUM/AVG/MIN/MAX/COUNT/NONE as valid for NUM', () => {
    expect([...TYPE_AGGREGATE_COMPATIBILITY.NUM].sort()).toEqual(
      ['AVG', 'COUNT', 'MAX', 'MIN', 'NONE', 'SUM'].sort(),
    );
  });

  it('lists only NONE as valid for TEXT/DATE/TIME', () => {
    expect(TYPE_AGGREGATE_COMPATIBILITY.TEXT).toEqual(['NONE']);
    expect(TYPE_AGGREGATE_COMPATIBILITY.DATE).toEqual(['NONE']);
    expect(TYPE_AGGREGATE_COMPATIBILITY.TIME).toEqual(['NONE']);
  });
});
