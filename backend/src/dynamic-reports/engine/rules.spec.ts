import { evaluateRule, evaluateRules } from './rules';
import type { RuleDefinitionLike, SubmissionValuesLike } from './rules';

function rule(overrides: Partial<RuleDefinitionLike> = {}): RuleDefinitionLike {
  return {
    id: 'rule1',
    name: 'D10 phải bằng D11+D12',
    leftExpr: 'D10',
    operator: 'EQ',
    rightExpr: 'D11+D12',
    severity: 'ERROR',
    message: 'D10 không khớp tổng D11+D12',
    missingStrategy: null,
    ...overrides,
  };
}

const SHEET = 'Đội 3';

function values(entries: Record<string, string | null>): SubmissionValuesLike {
  const out: SubmissionValuesLike = {};
  for (const [addr, v] of Object.entries(entries)) {
    out[`${SHEET}!${addr}`] = { v };
  }
  return out;
}

describe('evaluateRule — EQ/NEQ/GT/GTE/LT/LTE', () => {
  it('EQ: not violated when left equals right (10 = 4+6)', () => {
    const result = evaluateRule(
      rule({ operator: 'EQ' }),
      values({ D10: '10', D11: '4', D12: '6' }),
      SHEET,
    );
    expect(result.violated).toBe(false);
  });

  it('EQ: violated when left differs from right (10 != 4+5)', () => {
    const result = evaluateRule(
      rule({ operator: 'EQ' }),
      values({ D10: '10', D11: '4', D12: '5' }),
      SHEET,
    );
    expect(result.violated).toBe(true);
  });

  it('NEQ: violated only when both sides ARE equal', () => {
    const r = rule({ operator: 'NEQ', leftExpr: 'D10', rightExpr: 'D11' });
    expect(
      evaluateRule(r, values({ D10: '5', D11: '5' }), SHEET).violated,
    ).toBe(true);
    expect(
      evaluateRule(r, values({ D10: '5', D11: '6' }), SHEET).violated,
    ).toBe(false);
  });

  it('GT/GTE/LT/LTE compare correctly', () => {
    const base = { leftExpr: 'D10', rightExpr: 'D11' };
    const v = values({ D10: '5', D11: '5' });
    expect(
      evaluateRule(rule({ ...base, operator: 'GT' }), v, SHEET).violated,
    ).toBe(true); // 5 > 5 false -> violated
    expect(
      evaluateRule(rule({ ...base, operator: 'GTE' }), v, SHEET).violated,
    ).toBe(false); // 5 >= 5 true
    expect(
      evaluateRule(rule({ ...base, operator: 'LT' }), v, SHEET).violated,
    ).toBe(true); // 5 < 5 false -> violated
    expect(
      evaluateRule(rule({ ...base, operator: 'LTE' }), v, SHEET).violated,
    ).toBe(false); // 5 <= 5 true
  });

  it('decimal precision: 0.1 + 0.2 EQ 0.3 is NOT violated (no float drift)', () => {
    const r = rule({ operator: 'EQ', leftExpr: 'D10', rightExpr: 'D11+D12' });
    const result = evaluateRule(
      r,
      values({ D10: '0.3', D11: '0.1', D12: '0.2' }),
      SHEET,
    );
    expect(result.violated).toBe(false);
  });
});

describe('evaluateRule — blank cells behave as 0 (Excel convention, D07), not a missing-data error', () => {
  it('a never-typed cell evaluates as 0 regardless of missingStrategy — the rule still runs', () => {
    // D11 blank: left=10, right=0+6=6 -> 10 != 6 -> violated, same under every strategy.
    for (const missingStrategy of [null, 'SKIP', 'BLOCK']) {
      const result = evaluateRule(
        rule({ missingStrategy }),
        values({ D10: '10', D11: null, D12: '6' }),
        SHEET,
      );
      expect(result.violated).toBe(true);
    }
  });
});

describe('evaluateRule — genuinely unresolvable reference + missingStrategy', () => {
  it('defaults to SKIP (not violated) when the reference cannot be resolved at all', () => {
    const result = evaluateRule(
      rule({ missingStrategy: null }),
      values({ D10: '10', D11: '4', D12: '6' }),
      null, // no default sheet and no explicit prefix -> unresolvable
    );
    expect(result.violated).toBe(false);
  });

  it('missingStrategy=BLOCK treats an unresolvable reference as violated', () => {
    const result = evaluateRule(
      rule({ missingStrategy: 'BLOCK' }),
      values({ D10: '10', D11: '4', D12: '6' }),
      null,
    );
    expect(result.violated).toBe(true);
  });
});

describe('evaluateRule — COMPULSORY_PAIR / EXCLUSIVE_PAIR not yet supported', () => {
  it('never evaluates as violated (documented out-of-scope for this slice)', () => {
    expect(
      evaluateRule(rule({ operator: 'COMPULSORY_PAIR' }), values({}), SHEET)
        .violated,
    ).toBe(false);
    expect(
      evaluateRule(rule({ operator: 'EXCLUSIVE_PAIR' }), values({}), SHEET)
        .violated,
    ).toBe(false);
  });
});

describe('evaluateRule — sheet resolution', () => {
  it('uses an explicit "Sheet!Cell" prefix in the expression over the default sheet', () => {
    const r = rule({ leftExpr: 'Đội 4!D10', rightExpr: 'D11', operator: 'EQ' });
    const v: SubmissionValuesLike = {
      'Đội 4!D10': { v: '10' },
      [`${SHEET}!D11`]: { v: '10' },
    };
    expect(evaluateRule(r, v, SHEET).violated).toBe(false);
  });

  it('cannot resolve a bare cell ref with no default sheet — missingStrategy governs it', () => {
    const r = rule({ missingStrategy: 'BLOCK' });
    const result = evaluateRule(
      r,
      values({ D10: '10', D11: '4', D12: '6' }),
      null,
    );
    expect(result.violated).toBe(true);
  });
});

describe('evaluateRules — collects violations across many rules', () => {
  it('returns one RuleViolation per violated rule, preserving rule metadata', () => {
    const rules = [
      rule({
        id: 'r1',
        name: 'Rule 1',
        operator: 'EQ',
        leftExpr: 'D10',
        rightExpr: 'D11',
      }),
      rule({
        id: 'r2',
        name: 'Rule 2',
        severity: 'WARNING',
        operator: 'EQ',
        leftExpr: 'D20',
        rightExpr: 'D21',
        message: 'Cảnh báo D20/D21',
      }),
    ];
    const v = values({ D10: '5', D11: '6', D20: '1', D21: '1' });
    const violations = evaluateRules(rules, v, SHEET);

    expect(violations).toEqual([
      {
        ruleId: 'r1',
        name: 'Rule 1',
        severity: 'ERROR',
        message: 'D10 không khớp tổng D11+D12',
      },
    ]);
  });

  it('returns an empty array when nothing is violated', () => {
    const rules = [rule({ leftExpr: 'D10', rightExpr: 'D10' })];
    const violations = evaluateRules(rules, values({ D10: '5' }), SHEET);
    expect(violations).toEqual([]);
  });
});
