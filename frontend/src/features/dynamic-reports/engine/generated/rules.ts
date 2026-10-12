import Decimal from 'decimal.js';
import { evaluateFormula } from './expr';
import type { CellReference, CellResolution, EvalContext } from './expr';
import {
  DEFAULT_MAX_RANGE_CELLS,
  WorkbookEvaluator,
  expandRangeRefs,
} from './workbook-eval';
import type { WorkbookModel } from './workbook-eval';

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

/**
 * Sheets in the order they first appear in the submission's keys. Without a
 * workbook model that is the best available tab order for a 3-D span.
 */
function sheetOrderOf(values: SubmissionValuesLike, defaultSheet: string | null): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const add = (name: string): void => {
    if (!seen.has(name)) {
      seen.add(name);
      order.push(name);
    }
  };
  if (defaultSheet) add(defaultSheet);
  for (const k of Object.keys(values)) {
    const bang = k.lastIndexOf('!');
    if (bang > 0) add(k.slice(0, bang));
  }
  return order;
}

function buildEvalContext(
  values: SubmissionValuesLike,
  defaultSheet: string | null,
  workbook?: WorkbookModel,
  evaluator?: WorkbookEvaluator,
): EvalContext {
  // With the workbook model, a rule sees exactly what the grid shows: formula
  // cells are computed, static constants are real, and a missing sheet is
  // told apart from an excluded one (OV1).
  if (workbook && evaluator && defaultSheet) {
    return evaluator.contextFor(defaultSheet);
  }

  const order = sheetOrderOf(values, defaultSheet);
  function resolveCell(ref: CellReference): CellResolution {
    const sheet = ref.sheet ?? defaultSheet;
    if (!sheet) return { kind: 'not_found' };
    const raw = values[`${sheet}!${ref.cell}`]?.v;
    if (raw === undefined || raw === null || raw === '') {
      return { kind: 'blank' };
    }
    // Keep the typed digits: the engine parses the string with decimal.js,
    // so nothing is lost to a double on the way in (OV4).
    if (Number.isNaN(Number(raw))) return { kind: 'not_found' };
    return { kind: 'value', value: raw };
  }
  return {
    resolveCell,
    expandRange: (range) =>
      expandRangeRefs(range, defaultSheet ?? '', order, DEFAULT_MAX_RANGE_CELLS),
    prevValue: () => ({ kind: 'none' }),
  };
}

function evaluatorFor(
  values: SubmissionValuesLike,
  workbook: WorkbookModel | undefined,
): WorkbookEvaluator | undefined {
  if (!workbook) return undefined;
  const inputs: Record<string, string | null> = {};
  for (const [k, cell] of Object.entries(values)) inputs[k] = cell?.v ?? null;
  return new WorkbookEvaluator(workbook, inputs, { blankAs: 'blank' });
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
function checkRule(rule: RuleDefinitionLike, ctx: EvalContext): { violated: boolean } {
  if (
    rule.operator === 'COMPULSORY_PAIR' ||
    rule.operator === 'EXCLUSIVE_PAIR'
  ) {
    return { violated: false };
  }

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

/**
 * `workbook` is optional. Pass it wherever the template's cell model is
 * available (it is the same model the grid renders) and a rule can read
 * formula cells and static constants; omit it and a rule sees only the
 * submitted input values.
 */
export function evaluateRule(
  rule: RuleDefinitionLike,
  values: SubmissionValuesLike,
  defaultSheet: string | null,
  workbook?: WorkbookModel,
): { violated: boolean } {
  const evaluator = evaluatorFor(values, workbook);
  return checkRule(rule, buildEvalContext(values, defaultSheet, workbook, evaluator));
}

export function evaluateRules(
  rules: RuleDefinitionLike[],
  values: SubmissionValuesLike,
  defaultSheet: string | null,
  workbook?: WorkbookModel,
): RuleViolation[] {
  // One evaluator for all rules: the dependency graph is built once.
  const evaluator = evaluatorFor(values, workbook);
  const ctx = buildEvalContext(values, defaultSheet, workbook, evaluator);
  const violations: RuleViolation[] = [];
  for (const rule of rules) {
    if (checkRule(rule, ctx).violated) {
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