import type { LegacyFieldValue } from '@/features/legacy-form/types';

/** What the server's analysis says to put in the form (mirrors the backend `Projection`). */
export interface ProjectionFill {
  field: string;
  value: string | number;
  policy: 'AI_FILL' | 'AI_FILL_MUST_CONFIRM';
  provenance: {
    claimKind: 'QUOTED' | 'INFERRED' | 'ESTABLISHED';
    pageId: string | null;
    quote: string | null;
  };
  warnings: string[];
  /** A value that still has to be matched against a directory: it cannot be written into the form as it is. */
  pending?: { kind: string };
}

export interface ProjectionSkip {
  field: string;
  reason: string;
  candidates?: number[];
}

export interface Projection {
  fills: ProjectionFill[];
  skips: ProjectionSkip[];
}

/** The only two things this module needs from a form: read a field and write one without mutating the form. */
export interface FormAccess<TForm> {
  read(form: TForm, field: string): LegacyFieldValue;
  write(form: TForm, field: string, value: LegacyFieldValue): TForm;
}

export interface AppliedPatch {
  field: string;
  /** What the field held before, so undo can put it back. */
  before: LegacyFieldValue;
  /** What was written, as text. */
  value: string;
  /** The officer must press Confirm before saving. */
  orange: boolean;
  provenance: ProjectionFill['provenance'];
  warnings: string[];
}

export type SkipKind = 'TYPED_BY_OFFICER' | 'NEEDS_RESOLUTION';

export interface SkippedFill {
  field: string;
  value: string | number;
  reason: SkipKind;
  current: LegacyFieldValue;
  fill: ProjectionFill;
}

export interface FillPlan<TForm> {
  form: TForm;
  applied: AppliedPatch[];
  skipped: SkippedFill[];
}

const asText = (value: LegacyFieldValue): string =>
  Array.isArray(value) ? value.join('\u0000') : String(value);

const isEmpty = (value: LegacyFieldValue): boolean =>
  Array.isArray(value)
    ? value.length === 0
    : typeof value === 'boolean'
      ? !value
      : value.trim() === '';

/**
 * Decides what to put into the open form, field by field, without ever overwriting what the officer typed.
 *
 * A field may be filled when it is empty, when it still holds what the form itself started with (a default such as
 * today's date), or when it still holds what an earlier reading wrote. Anything else was put there by a person, and
 * stays. Values that need a directory lookup are not written; they are returned as skipped so the screen can offer them.
 */
export function planFill<TForm>(
  access: FormAccess<TForm>,
  input: {
    form: TForm;
    /** The form as it was when the drawer opened: the values it started with. */
    baseline: TForm;
    /** What earlier readings of this session wrote, by field. */
    lastFilled: Readonly<Record<string, string>>;
    projection: Projection;
  },
): FillPlan<TForm> {
  let form = input.form;
  const applied: AppliedPatch[] = [];
  const skipped: SkippedFill[] = [];

  for (const fill of input.projection.fills) {
    const current = access.read(form, fill.field);
    if (fill.pending) {
      skipped.push({
        field: fill.field,
        value: fill.value,
        reason: 'NEEDS_RESOLUTION',
        current,
        fill,
      });
      continue;
    }
    const untouched =
      isEmpty(current) ||
      asText(current) === asText(access.read(input.baseline, fill.field)) ||
      asText(current) === input.lastFilled[fill.field];
    if (!untouched) {
      skipped.push({
        field: fill.field,
        value: fill.value,
        reason: 'TYPED_BY_OFFICER',
        current,
        fill,
      });
      continue;
    }
    const value = String(fill.value);
    form = access.write(form, fill.field, value);
    applied.push({
      field: fill.field,
      before: current,
      value,
      orange: fill.policy === 'AI_FILL_MUST_CONFIRM' || fill.warnings.length > 0,
      provenance: fill.provenance,
      warnings: fill.warnings,
    });
  }
  return { form, applied, skipped };
}

/**
 * Takes the filled values back out, but only where the field still holds exactly what was written. A field the
 * officer has changed since stays as they left it and is reported as a conflict.
 */
export function undoFill<TForm>(
  access: FormAccess<TForm>,
  form: TForm,
  applied: readonly AppliedPatch[],
): { form: TForm; undone: string[]; conflicts: string[] } {
  let next = form;
  const undone: string[] = [];
  const conflicts: string[] = [];
  for (const patch of applied) {
    if (asText(access.read(next, patch.field)) === patch.value) {
      next = access.write(next, patch.field, patch.before);
      undone.push(patch.field);
    } else {
      conflicts.push(patch.field);
    }
  }
  return { form: next, undone, conflicts };
}

/**
 * Orange fields still waiting for the officer. A field they have edited is no longer waiting, because the value in it
 * is now theirs; so is one they pressed Confirm on.
 */
export function unconfirmedPatches<TForm>(
  access: FormAccess<TForm>,
  form: TForm,
  applied: readonly AppliedPatch[],
  confirmed: ReadonlySet<string>,
): AppliedPatch[] {
  return applied.filter(
    (patch) =>
      patch.orange &&
      !confirmed.has(patch.field) &&
      asText(access.read(form, patch.field)) === patch.value,
  );
}
