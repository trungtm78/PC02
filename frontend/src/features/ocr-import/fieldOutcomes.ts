import type { AppliedPatch, FormAccess } from './fillPlan';

export type FieldOutcome = 'KEPT' | 'EDITED' | 'CLEARED';

export interface FieldOutcomeRow {
  field: string;
  outcome: FieldOutcome;
  /** The field was one the officer had to confirm. */
  mustConfirm: boolean;
}

/**
 * What became of each field the scans filled, at the moment the record is saved: kept as read, changed, or emptied.
 * Only the field name and the outcome are returned, never a value, so this can be recorded for quality statistics
 * without copying anything read from a scan.
 */
export function fieldOutcomes<TForm>(
  access: FormAccess<TForm>,
  form: TForm,
  applied: readonly AppliedPatch[],
): FieldOutcomeRow[] {
  return applied.map((patch) => {
    const now = access.read(form, patch.field);
    const text = Array.isArray(now) ? now.join('\u0000') : String(now);
    const outcome: FieldOutcome = text === patch.value ? 'KEPT' : text.trim() === '' ? 'CLEARED' : 'EDITED';
    return { field: patch.field, outcome, mustConfirm: patch.orange };
  });
}
