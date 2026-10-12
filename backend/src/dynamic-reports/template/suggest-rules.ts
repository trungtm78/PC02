import { formatFormula, parseFormula } from '../engine/expr';
import type { Expr } from '../engine/expr';
import type { ParsedFormulaCell } from './types';
import type { DerivedRuleOperator } from './validation-constraints';

/**
 * Validation-rule suggestion (spec §10 PR3 checklist). Legacy BCA
 * templates encode a manual cross-check directly in a formula cell, e.g.
 * `=IF(D10=D11+D12,TRUE,FALSE)` — col-D rows 11/12 must sum to row 10. We
 * only recognise the `=` comparison with literal TRUE/FALSE branches (the
 * exact shape every real template sample uses); any other IF shape
 * (different operator, string branches, nested IFs) is left as a plain
 * static formula — this is a suggestion, not a requirement to rewrite
 * every IF in the workbook.
 */
export interface SuggestedRule {
  sheetKey: string;
  address: string;
  /** What to call the rule in the wizard. */
  name: string;
  /** Always sheet-qualified: a rule is evaluated without a sheet of its own. */
  leftExpr: string;
  operator: DerivedRuleOperator;
  rightExpr: string;
  /** What an officer sees when the rule fails. */
  message: string;
  /** Where the suggestion comes from: a check written into a formula cell, or Excel's own data validation. */
  origin: 'IF_FORMULA' | 'DATA_VALIDATION';
}

const quote = (name: string): string => `'${name.replace(/'/g, "''")}'`;

/** Names the sheet on every reference that does not: a rule has no "this sheet" to fall back on. */
function qualify(expr: Expr, sheet: string): Expr {
  const go = (e: Expr): Expr => {
    switch (e.kind) {
      case 'cell':
        return e.sheet ? e : { ...e, sheet };
      case 'range':
        return e.sheetFrom ? e : { ...e, sheetFrom: sheet, sheetTo: sheet };
      case 'binary':
        return { ...e, left: go(e.left), right: go(e.right) };
      case 'unary':
        return { ...e, operand: go(e.operand) };
      case 'call':
        return { ...e, args: e.args.map(go) };
      case 'prev':
        return { ...e, ref: go(e.ref) };
      default:
        return e;
    }
  };
  return go(expr);
}

function qualified(text: string, sheet: string): string | null {
  const parsed = parseFormula(text);
  return parsed.ok ? formatFormula(qualify(parsed.expr, sheet)) : null;
}

const IF_EQUAL_TRUE_FALSE_RE =
  /^IF\(\s*(.+?)\s*=\s*(.+?)\s*,\s*TRUE\s*,\s*FALSE\s*\)$/i;

export function suggestValidationRules(
  formulas: ParsedFormulaCell[],
): SuggestedRule[] {
  const suggestions: SuggestedRule[] = [];
  for (const formula of formulas) {
    const match = IF_EQUAL_TRUE_FALSE_RE.exec(formula.expression.trim());
    if (!match) continue;
    const left = qualified(match[1], formula.sheetKey);
    const right = qualified(match[2], formula.sheetKey);
    if (left === null || right === null) continue; // a shape the engine cannot read is not a rule it could run
    suggestions.push({
      sheetKey: formula.sheetKey,
      address: formula.address,
      name: `${quote(formula.sheetKey)}!${formula.address}: ${match[1]} = ${match[2]}`,
      leftExpr: left,
      operator: 'EQ',
      rightExpr: right,
      message: `Kiểm tra ô ${formula.address} (${match[1]} = ${match[2]}) không đạt.`,
      origin: 'IF_FORMULA',
    });
  }
  return suggestions;
}
