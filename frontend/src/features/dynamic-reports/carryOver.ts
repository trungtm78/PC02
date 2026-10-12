import type { ParsedField, ReportDetailField, TemplatePreviewResult } from './types';
import { applyWebMarks } from './markRegion';

export interface CarryOverResult {
  result: TemplatePreviewResult;
  /** Field keys of the previous version that the new template keeps as input cells. */
  carried: string[];
  /** Previous input cells the new template no longer has (the cell is gone, locked, or now holds a formula). */
  lost: ReportDetailField[];
}

/**
 * "Cập nhật mẫu": the officer already named, typed and aggregated every input cell once. A new template file must
 * not make them do it again. Marks the cells of the previous version on the new preview where the cell is still a
 * cell that can be marked; cells the file itself declares (tokens) are already in the preview. What cannot be kept
 * is reported, never dropped silently — the author decides whether the new template lost them on purpose.
 *
 * One cell at a time: a single cell that cannot be marked must not reject the rest (`applyWebMarks` is atomic
 * per call on purpose, for a region the user picked; here every cell is its own decision).
 */
export function carryOverMarks(preview: TemplatePreviewResult, previous: ReportDetailField[]): CarryOverResult {
  let result = preview;
  const carried: string[] = [];
  const lost: ReportDetailField[] = [];
  for (const old of previous) {
    if (result.fields.some((f) => f.fieldKey === old.fieldKey)) {
      carried.push(old.fieldKey);
      continue;
    }
    const applied = applyWebMarks(result, [
      {
        sheetKey: old.sheetKey,
        address: old.address,
        label: old.label,
        type: old.type as ParsedField['type'],
        format: old.format ?? '',
        aggregate: old.aggregate as ParsedField['aggregate'],
      },
    ]);
    if (applied.ok) {
      result = applied.result;
      carried.push(old.fieldKey);
    } else {
      lost.push(old);
    }
  }
  return { result, carried, lost };
}

/** The properties the wizard has no editor for travel with the field they belong to. */
export function withPreviousExtras(
  fields: ParsedField[],
  previous: ReportDetailField[],
): Array<ParsedField & Partial<Pick<ReportDetailField, 'required' | 'blankPolicy' | 'scale' | 'maxLength' | 'helpText'>>> {
  const byKey = new Map(previous.map((f) => [f.fieldKey, f]));
  return fields.map((f) => {
    const old = byKey.get(f.fieldKey);
    if (!old) return f;
    return {
      ...f,
      required: old.required,
      blankPolicy: old.blankPolicy as ReportDetailField['blankPolicy'],
      ...(old.scale !== null ? { scale: old.scale } : {}),
      ...(old.maxLength !== null ? { maxLength: old.maxLength } : {}),
      ...(old.helpText ? { helpText: old.helpText } : {}),
    };
  });
}
