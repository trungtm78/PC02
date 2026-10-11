import Decimal from 'decimal.js';
import { evaluateFormula } from './expr';
import type { CellReference, CellResolution, EvalContext } from './expr';

/**
 * S36 (PR9 slice 1) — validation-rule evaluation, pure (spec §10 R2). Reuses
 * `expr.ts`'s `evaluateFormula` for both sides of a rule's comparison —
 * `leftExpr`/`rightExpr` are plain formula strings (e.g. "D10" or
 * "D11+D12"), not a separate mini-language, so no new parser is written
 * here. `COMPULSORY_PAIR`/`EXCLUSIVE_PAIR` operators are schema-ready
 * (`DynReportRuleOperator`) but their multi-cell semantics are out of scope
 * for this slice — they never evaluate as violated, documented at the
 * call site below, not silently wrong.
 */

export type RuleOperator =
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'COMPULSORY_PAIR'
  | 'EXCLUSIVE_PAIR';

export type RuleSeverity = 'ERROR' | 'WARNING';

export interface RuleDefinitionLike {
  id: string;
  name: string;
  leftExpr: string;
  operator: RuleOperator;
  rightExpr: string;
  severity: RuleSeverity;
  message: string;
  missingStrategy: string | null;
}

export interface RuleViolation {
  ruleId: string;
  name: string;
  severity: RuleSeverity;
  message: string;
}

export type SubmissionValuesLike = Record<
  string,
  { v: string | null } | undefined
>;

function buildEvalContext(
  values: SubmissionValuesLike,
  defaultSheet: string | null,
): EvalContext {
  function resolveCell(ref: CellReference): CellResolution {
    const sheet = ref.sheet ?? defaultSheet;
    if (!sheet) return { kind: 'not_found' };
    const raw = values[`${sheet}!${ref.cell}`]?.v;
    if (raw === undefined || raw === null || raw === '') {
      return { kind: 'blank' };
    }
    const num = Number(raw);
    if (Number.isNaN(num)) return { kind: 'not_found' };
    return { kind: 'value', value: num };
  }
  return {
    resolveCell,
    // Ranges don't appear in a two-sided rule comparison in this slice —
    // SUM-of-a-range belongs to the formula string itself (e.g.
    // "SUM(D11:D12)"), which `evaluateFormula` already expands; this
    // context is only ever queried for single-cell refs directly.
    expandRange: () => [],
    prevValue: () => ({ kind: 'none' }),
  };
}

/**
 * `missingStrategy` governs what happens when either side can't be
 * resolved (missing data, out-of-scope reference, parse error): `null`/
 * anything other than `'BLOCK'` defaults to SKIP — a cross-field check
 * can't meaningfully fire before both fields exist, and treating "not
 * entered yet" as a violation would block submission on legitimately
 * incomplete-but-in-progress data. `'BLOCK'` is the explicit opt-in for
 * rules where a missing operand itself IS the problem.
 */
export function evaluateRule(
  rule: RuleDefinitionLike,
  values: SubmissionValuesLike,
  defaultSheet: string | null,
): { violated: boolean } {
  if (
    rule.operator === 'COMPULSORY_PAIR' ||
    rule.operator === 'EXCLUSIVE_PAIR'
  ) {
    return { violated: false };
  }

  const ctx = buildEvalContext(values, defaultSheet);
  const left = evaluateFormula(rule.leftExpr, ctx);
  const right = evaluateFormula(rule.rightExpr, ctx);
  const strategy = rule.missingStrategy ?? 'SKIP';

  if (
    !left.ok ||
    !right.ok ||
    left.value.type !== 'number' ||
    right.value.type !== 'number'
  ) {
    return { violated: strategy === 'BLOCK' };
  }

  const l: Decimal = left.value.value;
  const r: Decimal = right.value.value;
  let satisfied: boolean;
  switch (rule.operator) {
    case 'EQ':
      satisfied = l.equals(r);
      break;
    case 'NEQ':
      satisfied = !l.equals(r);
      break;
    case 'GT':
      satisfied = l.greaterThan(r);
      break;
    case 'GTE':
      satisfied = l.greaterThanOrEqualTo(r);
      break;
    case 'LT':
      satisfied = l.lessThan(r);
      break;
    case 'LTE':
      satisfied = l.lessThanOrEqualTo(r);
      break;
  }
  return { violated: !satisfied };
}

export function evaluateRules(
  rules: RuleDefinitionLike[],
  values: SubmissionValuesLike,
  defaultSheet: string | null,
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  for (const rule of rules) {
    if (evaluateRule(rule, values, defaultSheet).violated) {
      violations.push({
        ruleId: rule.id,
        name: rule.name,
        severity: rule.severity,
        message: rule.message,
      });
    }
  }
  return violations;
}
