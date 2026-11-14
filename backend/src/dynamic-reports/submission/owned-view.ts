import { ownedKeys } from '../aggregate/contributors';
import { collectRefs, parseFormula } from '../engine/expr';

/**
 * What an editor of ONE team works with: the fields the team reports, and the validation rules that concern only
 * those fields.
 *
 * Applied where an assignment is loaded, so everything downstream (the field list sent to the screen, the check that
 * a saved or imported cell belongs to the report, the required-field check at submit, the team's own Excel file) sees
 * the team's part and nothing else, without each of them having to remember to filter.
 *
 * A team with no subset gets the same arrays back, untouched: reports made before subsets cost nothing extra.
 */
/**
 * The stored values an editor of this team is sent: those of the fields the team reports.
 *
 * A figure typed for a criterion that was later taken away from the team stays in the database (it is history, and
 * the totals already leave it out), but it is no longer the team's to read. Only the answer is narrowed; nothing
 * stored is touched. A team with no subset gets the very same object back.
 */
export function ownedValues<V>(assignment: { ownedFieldKeys?: unknown }, values: Record<string, V>): Record<string, V> {
  const keys = ownedKeys(assignment);
  if (keys === null) return values;
  const owned = new Set(keys);
  return Object.fromEntries(Object.entries(values).filter(([fieldKey]) => owned.has(fieldKey)));
}

/**
 * The comments an editor of this team is sent: those on the whole submission and those on a field the team reports.
 *
 * A comment on a criterion that was taken away from the team may quote its figure, so it goes the way the figure
 * does: it stays stored (a manager of the report still reads it) and is not the team's to read. A team with no subset
 * gets the very same list back.
 */
export function ownedComments<C extends { fieldKey: string | null }>(assignment: { ownedFieldKeys?: unknown }, comments: C[]): C[] {
  const keys = ownedKeys(assignment);
  if (keys === null) return comments;
  const owned = new Set(keys);
  return comments.filter((c) => c.fieldKey === null || owned.has(c.fieldKey));
}

export function ownedView<F extends { fieldKey: string }, R extends { leftExpr: string; rightExpr: string }>(
  assignment: { ownedFieldKeys?: unknown },
  fields: F[],
  rules: R[],
  defaultSheet: string | null,
): { fields: F[]; rules: R[] } {
  const keys = ownedKeys(assignment);
  if (keys === null) return { fields, rules };

  const owned = new Set(keys);
  const everyField = new Set(fields.map((f) => f.fieldKey));

  /** true when the expression reads no field of another team; false when it does, or when that cannot be told. */
  const concernsOnlyOwned = (source: string): boolean => {
    const parsed = parseFormula(source);
    if (!parsed.ok) return false;
    const refs = collectRefs(parsed.expr);
    // A range may sweep over cells the team does not report; rather than guess, the rule is not applied.
    if (refs.ranges.length > 0) return false;
    return refs.cells.every((ref) => {
      const sheet = ref.sheet ?? defaultSheet;
      if (!sheet) return false;
      const key = `${sheet}!${ref.cell.replace(/\$/g, '')}`;
      // A cell that is not an input of the version (a constant on the sheet) belongs to nobody.
      return !everyField.has(key) || owned.has(key);
    });
  };

  return {
    fields: fields.filter((f) => owned.has(f.fieldKey)),
    rules: rules.filter((r) => concernsOnlyOwned(r.leftExpr) && concernsOnlyOwned(r.rightExpr)),
  };
}
