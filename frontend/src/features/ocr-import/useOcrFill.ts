import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  planFill,
  undoFill,
  type AppliedPatch,
  type FormAccess,
  type SkippedFill,
} from './fillPlan';
import type { OcrAnalysisView } from './ocrApi';
import { useLatest } from './useLatest';

interface Binding {
  sessionId: string;
  analysisId: string;
}

export interface UseOcrFillArgs<TForm> {
  access: FormAccess<TForm>;
  form: TForm;
  setForm: Dispatch<SetStateAction<TForm>>;
  /**
   * The form as it started, before the officer typed anything: what "untouched" is measured against. Defaults to the
   * form at the first render; a page whose form is loaded or defaulted a moment later passes its own snapshot.
   */
  baseline?: TForm;
}

/**
 * Puts an analysis into the open form and keeps track of what it wrote, so the screen can show where each value came
 * from, take the filling back, and tell the server which scans the saved record was filled from.
 *
 * It never saves. It only changes fields the officer has not typed into, and a value that cannot be written as-is
 * (one that needs a directory match) is handed back as skipped rather than guessed.
 */
export function useOcrFill<TForm>({ access, form, setForm, baseline: given }: UseOcrFillArgs<TForm>) {
  const [applied, setApplied] = useState<AppliedPatch[]>([]);
  const [skipped, setSkipped] = useState<SkippedFill[]>([]);
  const [binding, setBinding] = useState<Binding | null>(null);

  const formRef = useLatest(form);
  const startRef = useRef(form);
  const baselineRef = useLatest(given);
  const appliedRef = useLatest(applied);
  const skippedRef = useLatest(skipped);

  const applyAnalysis = useCallback(
    (sessionId: string, analysis: OcrAnalysisView) => {
      const before = appliedRef.current;
      const baseline = baselineRef.current ?? startRef.current;
      const lastFilled = Object.fromEntries(before.map((p) => [p.field, p.value]));

      const plan = planFill(access, {
        form: formRef.current,
        baseline,
        lastFilled,
        projection: analysis.projection,
      });

      // A field filled again keeps the value it had before the FIRST fill, so undo goes back to the start.
      const originalBefore = new Map(before.map((p) => [p.field, p.before]));
      const fresh = plan.applied.map((p) =>
        originalBefore.has(p.field) ? { ...p, before: originalBefore.get(p.field)! } : p,
      );
      const refreshed = new Set(fresh.map((p) => p.field));
      const merged = [...before.filter((p) => !refreshed.has(p.field)), ...fresh];

      setForm(plan.form);
      setApplied(merged);
      setSkipped(plan.skipped);
      setBinding({ sessionId, analysisId: analysis.id });
    },
    [access, setForm, formRef, appliedRef, baselineRef, startRef],
  );

  /** Takes the value from the image for a field the officer had already filled in; undo restores what they typed. */
  const takeSkippedValue = useCallback(
    (field: string) => {
      const skippedFill = skippedRef.current.find((s) => s.field === field);
      if (!skippedFill || skippedFill.reason !== 'TYPED_BY_OFFICER') return;
      const value = String(skippedFill.value);
      const current = access.read(formRef.current, field);
      setForm(access.write(formRef.current, field, value));
      setApplied((prev) => [
        ...prev.filter((p) => p.field !== field),
        {
          field,
          before: current,
          value,
          orange: skippedFill.fill.policy === 'AI_FILL_MUST_CONFIRM' || skippedFill.fill.warnings.length > 0,
          provenance: skippedFill.fill.provenance,
          warnings: skippedFill.fill.warnings,
        },
      ]);
      setSkipped((prev) => prev.filter((s) => s.field !== field));
    },
    [access, setForm, formRef, skippedRef],
  );

  const undo = useCallback((): { undone: string[]; conflicts: string[] } => {
    const result = undoFill(access, formRef.current, appliedRef.current);
    setForm(result.form);
    setApplied([]);
    setSkipped([]);
    return { undone: result.undone, conflicts: result.conflicts };
  }, [access, setForm, formRef, appliedRef]);

  /** Drops only the link to the scans (they were deleted): what was filled stays tracked. */
  const unbind = useCallback(() => setBinding(null), []);

  /** Drops the link to the scans (the form was cleared, or the officer chose not to attach them). */
  const forget = useCallback(() => {
    setApplied([]);
    setSkipped([]);
    setBinding(null);
  }, []);

  const bindingForSave = useCallback(
    (): { ocrPhienId?: string; ocrPhienBan?: string } =>
      binding ? { ocrPhienId: binding.sessionId, ocrPhienBan: binding.analysisId } : {},
    [binding],
  );

  return {
    applied,
    skipped,
    applyAnalysis,
    takeSkippedValue,
    undo,
    unbind,
    forget,
    bindingForSave,
  };
}
