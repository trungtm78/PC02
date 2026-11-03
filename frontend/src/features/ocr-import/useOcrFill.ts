import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  planFill,
  undoFill,
  unconfirmedPatches,
  type AppliedPatch,
  type FormAccess,
  type SkippedFill,
} from './fillPlan';
import type { OcrAnalysisView } from './ocrApi';

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
 * from, ask the officer to confirm the risky ones, take the filling back, and tell the server which scans the saved
 * record was filled from.
 *
 * It never saves. It only changes fields the officer has not typed into, and a value that cannot be written as-is
 * (one that needs a directory match) is handed back as skipped rather than guessed.
 */
export function useOcrFill<TForm>({ access, form, setForm, baseline: given }: UseOcrFillArgs<TForm>) {
  const [applied, setApplied] = useState<AppliedPatch[]>([]);
  const [skipped, setSkipped] = useState<SkippedFill[]>([]);
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());
  const [binding, setBinding] = useState<Binding | null>(null);

  const formRef = useRef(form);
  formRef.current = form;
  const startRef = useRef(form);
  const baselineRef = useRef<TForm | undefined>(given);
  baselineRef.current = given;
  const appliedRef = useRef<AppliedPatch[]>([]);
  appliedRef.current = applied;

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
      setConfirmed((prev) => new Set([...prev].filter((f) => !refreshed.has(f))));
      setBinding({ sessionId, analysisId: analysis.id });
    },
    [access, setForm],
  );

  const confirm = useCallback((field: string) => {
    setConfirmed((prev) => new Set(prev).add(field));
  }, []);

  const undo = useCallback((): { undone: string[]; conflicts: string[] } => {
    const result = undoFill(access, formRef.current, appliedRef.current);
    setForm(result.form);
    setApplied([]);
    setSkipped([]);
    setConfirmed(new Set());
    return { undone: result.undone, conflicts: result.conflicts };
  }, [access, setForm]);

  /** Drops the link to the scans (the form was cleared, or the officer chose not to attach them). */
  const forget = useCallback(() => {
    setApplied([]);
    setSkipped([]);
    setConfirmed(new Set());
    setBinding(null);
  }, []);

  const unconfirmed = useMemo(
    () => unconfirmedPatches(access, form, applied, confirmed),
    [access, form, applied, confirmed],
  );

  const bindingForSave = useCallback(
    (): { ocrPhienId?: string; ocrPhienBan?: string } =>
      binding ? { ocrPhienId: binding.sessionId, ocrPhienBan: binding.analysisId } : {},
    [binding],
  );

  return {
    applied,
    skipped,
    confirmed,
    unconfirmed,
    blocksSave: unconfirmed.length > 0,
    firstUnconfirmedField: unconfirmed[0]?.field ?? null,
    applyAnalysis,
    confirm,
    undo,
    forget,
    bindingForSave,
  };
}
