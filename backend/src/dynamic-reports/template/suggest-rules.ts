import type { ParsedFormulaCell } from './types';

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
  leftExpr: string;
  operator: 'EQUAL';
  rightExpr: string;
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
    suggestions.push({
      sheetKey: formula.sheetKey,
      address: formula.address,
      leftExpr: match[1],
      operator: 'EQUAL',
      rightExpr: match[2],
    });
  }
  return suggestions;
}
